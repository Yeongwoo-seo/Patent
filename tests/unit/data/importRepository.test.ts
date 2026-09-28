import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb, closeDb } from '@/data/indexeddb/db';
import { DB_NAME } from '@/data/indexeddb/schema';
import { parseContentPackage, type RawContentPackageFiles } from '@/domain/import/parseContentPackage';
import { applyImport, runImportDryRun } from '@/data/repositories/importRepository';
import { submitAttempt } from '@/data/repositories/attemptRepository';
import type { GradingSpec, LearningItem } from '@/domain/types';

const PKG_ROOT = join(process.cwd(), 'content-package');

function readOrNull(rel: string): string | null {
  try {
    return readFileSync(join(PKG_ROOT, rel), 'utf8');
  } catch {
    return null;
  }
}

function loadRealPackage(): RawContentPackageFiles {
  return {
    manifestText: readOrNull('manifest.json'),
    learningItemsText: readOrNull('data/learning-items.jsonl'),
    gradingSpecsText: readOrNull('data/grading-specs.jsonl'),
    durationRulesText: readOrNull('data/duration-rules.jsonl'),
    textbookParagraphsText: readOrNull('data/textbook-paragraphs.jsonl'),
    contentLinksText: readOrNull('data/content-links.jsonl'),
    choiceOptionsText: readOrNull('data/choice-options.jsonl'),
    sourceAssetsText: readOrNull('data/source-assets.jsonl'),
    assetTextByBasename: {
      'demo-asset-trademark-mark-1.svg': readOrNull('assets/images/demo-asset-trademark-mark-1.svg') ?? '',
      'demo-asset-earth-plate-map-1.svg': readOrNull('assets/images/demo-asset-earth-plate-map-1.svg') ?? '',
      'demo-formula-physics-newton-second-law.json': readOrNull('assets/formulas/demo-formula-physics-newton-second-law.json') ?? '',
    },
  };
}

beforeEach(async () => {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
});

afterEach(async () => {
  await closeDb();
});

describe('import pipeline — against the real content-package/', () => {
  it('dry-run on an empty DB reports every learning item as new and canApply=true', async () => {
    const db = await getDb();
    const parsed = parseContentPackage(loadRealPackage());
    const report = await runImportDryRun(parsed, db);
    expect(report.canApply).toBe(true);
    expect(report.validationIssues).toEqual([]);
    expect(report.summary.new).toBe(parsed.learningItems.length);
    expect(report.summary.unchanged).toBe(0);
  });

  it('applies cleanly and the content stores are populated', async () => {
    const db = await getDb();
    const parsed = parseContentPackage(loadRealPackage());
    const report = await runImportDryRun(parsed, db);
    const record = await applyImport(parsed, report, db, () => new Date('2026-09-28T00:00:00Z'));

    expect(record.counts.added).toBe(parsed.learningItems.length);
    expect(await db.count('learningItems')).toBe(parsed.learningItems.length);
    expect(await db.count('gradingSpecs')).toBe(parsed.gradingSpecs.length);
    expect(await db.count('sourceAssets')).toBe(parsed.sourceAssets.length);
    expect(await db.count('contentPackImports')).toBe(1);
  });

  it('re-importing the identical package a second time reports everything as unchanged (idempotent)', async () => {
    const db = await getDb();
    const parsed = parseContentPackage(loadRealPackage());
    const first = await runImportDryRun(parsed, db);
    await applyImport(parsed, first, db);

    const second = await runImportDryRun(parsed, db);
    expect(second.summary.new).toBe(0);
    expect(second.summary.unchanged).toBe(parsed.learningItems.length);

    await applyImport(parsed, second, db);
    // 두 번 반영해도 레코드 수가 늘어나지 않는다.
    expect(await db.count('learningItems')).toBe(parsed.learningItems.length);
  });

  it('never touches attemptEvents/reviewStates — a users existing history survives a re-import', async () => {
    const db = await getDb();
    const parsed = parseContentPackage(loadRealPackage());
    const report = await runImportDryRun(parsed, db);
    await applyImport(parsed, report, db);

    const item = parsed.learningItems.find((i) => i.gradingSpecId)!;
    const spec = parsed.gradingSpecs.find((s) => s.id === item.gradingSpecId) as GradingSpec;

    await submitAttempt(
      {
        learnerId: 'local',
        deviceId: 'device-a',
        deviceSequence: 1,
        sessionId: 'sess-1',
        correlationId: 'corr-1',
        item,
        gradingSpec: spec,
        answer: spec.kind === 'ox' ? { kind: 'ox', value: spec.correctOxValue ?? 'O' } : { kind: 'ox', value: 'unknown' },
        confidenceBeforeReveal: 'sure',
        assistance: 'none',
        selfReported: false,
        activeDurationMs: 1000,
        errorTags: [],
        source: 'manual_answer',
        mode: 'ox_review',
        now: () => new Date('2026-09-28T01:00:00Z'),
      },
      db,
    );

    const attemptCountBefore = await db.count('attemptEvents');
    const stateBefore = await db.get('reviewStates', ['local', item.id, item.learningEpoch]);
    expect(stateBefore).toBeDefined();

    // 같은 패키지를 다시 가져온다(재수입 시나리오).
    const secondReport = await runImportDryRun(parsed, db);
    await applyImport(parsed, secondReport, db);

    expect(await db.count('attemptEvents')).toBe(attemptCountBefore);
    const stateAfter = await db.get('reviewStates', ['local', item.id, item.learningEpoch]);
    expect(stateAfter).toEqual(stateBefore);
  });

  it('skips epoch_conflict items and never overwrites a newer local learningEpoch with an older one', async () => {
    const db = await getDb();
    const parsed = parseContentPackage(loadRealPackage());
    const report = await runImportDryRun(parsed, db);
    await applyImport(parsed, report, db);

    const targetId = parsed.learningItems[0]!.id;
    const current = (await db.get('learningItems', targetId)) as LearningItem;

    // 로컬에서 이미 더 높은 learningEpoch로 올라가 있다고 가정(예: 이전에 새 버전을 반영한 상태).
    await db.put('learningItems', { ...current, learningEpoch: current.learningEpoch + 5, contentRevisionId: 'local-newer' });

    const staleReport = await runImportDryRun(parsed, db);
    const conflictEntry = staleReport.learningItemDiffs.find((e) => e.id === targetId);
    expect(conflictEntry?.kind).toBe('epoch_conflict');

    await applyImport(parsed, staleReport, db);
    const afterApply = (await db.get('learningItems', targetId)) as LearningItem;
    expect(afterApply.learningEpoch).toBe(current.learningEpoch + 5);
    expect(afterApply.contentRevisionId).toBe('local-newer');
  });

  it('refuses to apply when the dry-run found validation issues', async () => {
    const db = await getDb();
    const parsed = parseContentPackage(loadRealPackage());
    parsed.learningItems.push({ ...parsed.learningItems[0]! }); // 중복 id 주입
    const report = await runImportDryRun(parsed, db);
    expect(report.canApply).toBe(false);
    await expect(applyImport(parsed, report, db)).rejects.toThrow();
  });
});
