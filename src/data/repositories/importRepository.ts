import type { IDBPDatabase } from 'idb';
import { diffById, diffLearningItems, findRemovedIds, type LearningItemDiffEntry, type SimpleDiffEntry } from '../../domain/import/diffContentPackage';
import { validatePackage, type ValidationIssue } from '../../domain/import/validatePackage';
import type { ContentPackManifest, ParsedContentPackage } from '../../domain/import/types';
import type { ContentPackImportRecord } from '../../domain/types';
import type { HoedokshilDB } from '../indexeddb/schema';
import { getDb } from '../indexeddb/db';

export type ImportDryRunReport = {
  manifest: ContentPackManifest | null;
  parseErrors: ParsedContentPackage['parseErrors'];
  validationIssues: ValidationIssue[];
  learningItemDiffs: LearningItemDiffEntry[];
  removedLearningItemIds: string[];
  gradingSpecDiffs: SimpleDiffEntry[];
  durationRuleDiffs: SimpleDiffEntry[];
  textbookParagraphDiffs: SimpleDiffEntry[];
  contentLinkDiffs: SimpleDiffEntry[];
  sourceAssetDiffs: SimpleDiffEntry[];
  choiceOptionDiffs: SimpleDiffEntry[];
  /** 파싱/검증 오류가 하나라도 있으면 false — 그 상태에서는 적용을 막는다(20.2 dry-run 원칙). */
  canApply: boolean;
  summary: {
    new: number;
    updatedSameEpoch: number;
    newEpoch: number;
    unchanged: number;
    epochConflicts: number;
  };
};

function summarizeLearningItemDiffs(entries: LearningItemDiffEntry[]): ImportDryRunReport['summary'] {
  const summary = { new: 0, updatedSameEpoch: 0, newEpoch: 0, unchanged: 0, epochConflicts: 0 };
  for (const e of entries) {
    if (e.kind === 'new') summary.new += 1;
    else if (e.kind === 'updated_same_epoch') summary.updatedSameEpoch += 1;
    else if (e.kind === 'new_epoch') summary.newEpoch += 1;
    else if (e.kind === 'unchanged') summary.unchanged += 1;
    else if (e.kind === 'epoch_conflict') summary.epochConflicts += 1;
  }
  return summary;
}

/**
 * 20.2 dry-run: 아무것도 쓰지 않고 "반영하면 무엇이 바뀌는지"만 계산한다.
 * IMPORT_RULES.md의 핵심 - 여기서 계산한 epoch_conflict 항목은 applyImport가 절대 적용하지 않는다.
 */
export async function runImportDryRun(
  parsed: ParsedContentPackage,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<ImportDryRunReport> {
  const database = db ?? (await getDb());

  const [existingItems, existingSpecs, existingRules, existingParagraphs, existingLinks, existingAssets, existingChoiceOptions] =
    await Promise.all([
      database.getAll('learningItems'),
      database.getAll('gradingSpecs'),
      database.getAll('durationRules'),
      database.getAll('textbookParagraphs'),
      database.getAll('contentLinks'),
      database.getAll('sourceAssets'),
      database.getAll('choiceOptions'),
    ]);

  const validationIssues = validatePackage(parsed);
  const learningItemDiffs = diffLearningItems(existingItems, parsed.learningItems);
  const removedLearningItemIds = findRemovedIds(existingItems, parsed.learningItems);
  const gradingSpecDiffs = diffById(existingSpecs, parsed.gradingSpecs);
  const durationRuleDiffs = diffById(existingRules, parsed.durationRules);
  const textbookParagraphDiffs = diffById(existingParagraphs, parsed.textbookParagraphs);
  const contentLinkDiffs = diffById(existingLinks, parsed.contentLinks);
  const sourceAssetDiffs = diffById(existingAssets, parsed.sourceAssets);
  const choiceOptionDiffs = diffById(
    existingChoiceOptions.map((c) => ({ ...c, id: c.itemId })),
    parsed.choiceOptions.map((c) => ({ ...c, id: c.itemId })),
  );

  return {
    manifest: parsed.manifest,
    parseErrors: parsed.parseErrors,
    validationIssues,
    learningItemDiffs,
    removedLearningItemIds,
    gradingSpecDiffs,
    durationRuleDiffs,
    textbookParagraphDiffs,
    contentLinkDiffs,
    sourceAssetDiffs,
    choiceOptionDiffs,
    canApply: parsed.parseErrors.length === 0 && validationIssues.length === 0,
    summary: summarizeLearningItemDiffs(learningItemDiffs),
  };
}

/**
 * IMPORT_RULES.md 0번: 이 트랜잭션은 콘텐츠 저장소만 선언한다 — attemptEvents/reviewStates/
 * exposureEvents/annotations 등은 store 목록에 아예 없으므로 구조적으로 건드릴 수 없다.
 * epoch_conflict로 분류된 학습 항목은 조용히 건너뛴다(적용하지 않음, 삭제하지도 않음).
 */
export async function applyImport(
  parsed: ParsedContentPackage,
  dryRun: ImportDryRunReport,
  db?: IDBPDatabase<HoedokshilDB>,
  now: () => Date = () => new Date(),
): Promise<ContentPackImportRecord> {
  if (!dryRun.canApply) {
    throw new Error('dry-run에서 파싱/검증 오류가 있어 적용할 수 없습니다. VALIDATION 결과를 먼저 해결하세요.');
  }
  const database = db ?? (await getDb());

  const skipIds = new Set(dryRun.learningItemDiffs.filter((e) => e.kind === 'epoch_conflict').map((e) => e.id));
  const itemsToApply = parsed.learningItems.filter((i) => !skipIds.has(i.id));

  const tx = database.transaction(
    ['learningItems', 'gradingSpecs', 'durationRules', 'textbookParagraphs', 'contentLinks', 'sourceAssets', 'choiceOptions', 'contentPackImports'],
    'readwrite',
  );
  await Promise.all([
    ...itemsToApply.map((i) => tx.objectStore('learningItems').put(i)),
    ...parsed.gradingSpecs.map((s) => tx.objectStore('gradingSpecs').put(s)),
    ...parsed.durationRules.map((r) => tx.objectStore('durationRules').put(r)),
    ...parsed.textbookParagraphs.map((p) => tx.objectStore('textbookParagraphs').put(p)),
    ...parsed.contentLinks.map((l) => tx.objectStore('contentLinks').put(l)),
    ...parsed.sourceAssets.map((a) => tx.objectStore('sourceAssets').put(a)),
    ...parsed.choiceOptions.map((c) => tx.objectStore('choiceOptions').put(c)),
  ]);

  const nowIso = now().toISOString();
  const record: ContentPackImportRecord = {
    id: `${parsed.manifest?.packId ?? 'unknown'}@${parsed.manifest?.contentVersion ?? '0'}-${nowIso}`,
    packId: parsed.manifest?.packId ?? 'unknown',
    namespace: parsed.manifest?.namespace ?? '',
    contentVersion: parsed.manifest?.contentVersion ?? '0',
    schemaVersion: parsed.manifest?.schemaVersion ?? '0',
    importedAtUtc: nowIso,
    counts: {
      added: dryRun.summary.new,
      updatedSameEpoch: dryRun.summary.updatedSameEpoch,
      newEpoch: dryRun.summary.newEpoch,
      unchanged: dryRun.summary.unchanged,
      skippedConflicts: dryRun.summary.epochConflicts,
    },
  };
  await tx.objectStore('contentPackImports').put(record);
  await tx.done;
  return record;
}
