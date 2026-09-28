import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseContentPackage, type RawContentPackageFiles } from '@/domain/import/parseContentPackage';
import { validatePackage } from '@/domain/import/validatePackage';
import { diffById, diffLearningItems, findRemovedIds } from '@/domain/import/diffContentPackage';
import type { LearningItem } from '@/domain/types';

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

describe('parseContentPackage + validatePackage — against the real content-package/', () => {
  it('parses the checked-in content-package/ with zero parse errors', () => {
    const parsed = parseContentPackage(loadRealPackage());
    expect(parsed.parseErrors).toEqual([]);
    expect(parsed.learningItems.length).toBeGreaterThan(0);
    expect(parsed.manifest?.packId).toBe('hoedokshil-demo-civil-ip-science-v1');
  });

  it('finds zero referential-integrity issues in the real package (mirrors content-package validator)', () => {
    const parsed = parseContentPackage(loadRealPackage());
    const issues = validatePackage(parsed);
    expect(issues).toEqual([]);
  });
});

describe('parseContentPackage — malformed input', () => {
  it('collects a parse issue per bad JSONL line instead of throwing', () => {
    const raw: RawContentPackageFiles = {
      manifestText: '{"schemaVersion":"1.0.0"}',
      learningItemsText: '{"id":"a"}\n{not valid json\n{"id":"b"}',
      gradingSpecsText: null,
      durationRulesText: null,
      textbookParagraphsText: null,
      contentLinksText: null,
      choiceOptionsText: null,
      sourceAssetsText: null,
      assetTextByBasename: {},
    };
    const parsed = parseContentPackage(raw);
    expect(parsed.learningItems).toHaveLength(2);
    expect(parsed.parseErrors).toHaveLength(1);
    expect(parsed.parseErrors[0]?.file).toBe('learning-items.jsonl');
    expect(parsed.parseErrors[0]?.line).toBe(2);
  });

  it('flags a source asset whose file content was not uploaded', () => {
    const raw: RawContentPackageFiles = {
      manifestText: '{}',
      learningItemsText: null,
      gradingSpecsText: null,
      durationRulesText: null,
      textbookParagraphsText: null,
      contentLinksText: null,
      choiceOptionsText: null,
      sourceAssetsText: JSON.stringify({ id: 'asset-1', kind: 'image', path: 'assets/images/missing.svg', mimeType: 'image/svg+xml', sha256: 'x', byteSize: 1, isSynthetic: true, licenseScope: 'test-only', sourceLocation: null }),
      assetTextByBasename: {},
    };
    const parsed = parseContentPackage(raw);
    expect(parsed.sourceAssets[0]?.textContent).toBeNull();
    expect(parsed.parseErrors.some((e) => e.message.includes('missing.svg'))).toBe(true);
  });
});

describe('validatePackage — injected defects', () => {
  const baseItem = (overrides: Partial<LearningItem> = {}): LearningItem => ({
    id: 'item-1',
    subjectId: 'civil',
    kind: 'legal_statement',
    sourceContentId: 'src-1',
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: [],
    relatedItemIds: [],
    requiredAssetIds: [],
    availableContexts: ['micro'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: null,
    verification: 'verified',
    isSynthetic: true,
    prompt: 'test',
    ...overrides,
  });

  it('reports duplicate ids within the incoming learning-items collection', () => {
    const parsed = parseContentPackage(rawFrom({ learningItems: [baseItem(), baseItem()] }));
    const issues = validatePackage(parsed);
    expect(issues.some((i) => i.check === 'duplicate_id' && i.id === 'item-1')).toBe(true);
  });

  it('reports a broken gradingSpecId reference', () => {
    const parsed = parseContentPackage(rawFrom({ learningItems: [baseItem({ gradingSpecId: 'does-not-exist' })] }));
    const issues = validatePackage(parsed);
    expect(issues.some((i) => i.check === 'broken_reference' && i.message.includes('does-not-exist'))).toBe(true);
  });

  it('reports a missing required asset', () => {
    const parsed = parseContentPackage(rawFrom({ learningItems: [baseItem({ requiredAssetIds: ['missing-asset'] })] }));
    const issues = validatePackage(parsed);
    expect(issues.some((i) => i.check === 'missing_asset')).toBe(true);
  });
});

function rawFrom(parts: { learningItems?: LearningItem[] }): RawContentPackageFiles {
  return {
    manifestText: '{}',
    learningItemsText: (parts.learningItems ?? []).map((i) => JSON.stringify(i)).join('\n'),
    gradingSpecsText: '',
    durationRulesText: '',
    textbookParagraphsText: '',
    contentLinksText: '',
    choiceOptionsText: '',
    sourceAssetsText: '',
    assetTextByBasename: {},
  };
}

describe('diffLearningItems (IMPORT_RULES.md 1번)', () => {
  const existingItem: LearningItem = {
    id: 'x',
    subjectId: 'civil',
    kind: 'legal_statement',
    sourceContentId: 'src',
    contentRevisionId: 'rev-1',
    learningEpoch: 2,
    topicIds: [],
    relatedItemIds: [],
    requiredAssetIds: [],
    availableContexts: ['micro'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: null,
    verification: 'verified',
    isSynthetic: true,
    prompt: 'p',
  };

  it('classifies a brand-new id as new', () => {
    const incoming = { ...existingItem, id: 'y' };
    const [entry] = diffLearningItems([existingItem], [incoming]);
    expect(entry?.kind).toBe('new');
  });

  it('classifies identical contentRevisionId+learningEpoch as unchanged', () => {
    const [entry] = diffLearningItems([existingItem], [{ ...existingItem }]);
    expect(entry?.kind).toBe('unchanged');
  });

  it('classifies a same-epoch content tweak as updated_same_epoch (typo/formatting case)', () => {
    const incoming = { ...existingItem, contentRevisionId: 'rev-2' };
    const [entry] = diffLearningItems([existingItem], [incoming]);
    expect(entry?.kind).toBe('updated_same_epoch');
  });

  it('classifies a higher incoming learningEpoch as new_epoch', () => {
    const incoming = { ...existingItem, contentRevisionId: 'rev-2', learningEpoch: 3 };
    const [entry] = diffLearningItems([existingItem], [incoming]);
    expect(entry?.kind).toBe('new_epoch');
  });

  it('classifies a lower incoming learningEpoch as epoch_conflict (never auto-applied)', () => {
    const incoming = { ...existingItem, learningEpoch: 1 };
    const [entry] = diffLearningItems([existingItem], [incoming]);
    expect(entry?.kind).toBe('epoch_conflict');
  });

  it('findRemovedIds reports existing ids missing from the incoming set without deleting anything', () => {
    const removed = findRemovedIds([existingItem, { ...existingItem, id: 'gone' }], [existingItem]);
    expect(removed).toEqual(['gone']);
  });
});

describe('diffById (generic sub-entities)', () => {
  it('detects new/unchanged/updated by deep equality', () => {
    const a = { id: '1', v: 1 };
    const b = { id: '2', v: 1 };
    const bUpdated = { id: '2', v: 2 };
    const entries = diffById([a, b], [a, bUpdated, { id: '3', v: 9 }]);
    const byId = new Map(entries.map((e) => [e.id, e.kind]));
    expect(byId.get('1')).toBe('unchanged');
    expect(byId.get('2')).toBe('updated');
    expect(byId.get('3')).toBe('new');
  });
});
