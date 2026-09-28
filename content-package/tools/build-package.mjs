#!/usr/bin/env node
// 실행: node --experimental-strip-types content-package/tools/build-package.mjs
//
// 앱 소스(src/data/fixtures/demoContent.ts)를 단일 소스로 삼아 content-package/data/*.jsonl과
// manifest.json을 생성한다. 데이터를 이 스크립트 안에 직접 베끼지 않는다 - 앱과 패키지가
// 따로 놀면(drift) "재분석 없이 가져올 수 있는" 패키지라는 목적 자체가 깨진다.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  demoLearningItems,
  demoGradingSpecs,
  demoDurationRules,
  demoTextbookParagraphs,
  demoContentLinks,
  demoChoiceOptions,
} from '../../src/data/fixtures/demoContent.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..');
const DATA_DIR = join(PKG_ROOT, 'data');
const ASSETS_DIR = join(PKG_ROOT, 'assets');

mkdirSync(DATA_DIR, { recursive: true });

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function writeJsonl(filename, records) {
  const path = join(DATA_DIR, filename);
  const body = records.map((r) => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
  writeFileSync(path, body, 'utf8');
  return { path, recordCount: records.length };
}

// --- source-assets.jsonl: assets/ 아래 실제 파일을 스캔해 해시·크기·MIME을 기록한다. ---
const MIME_BY_EXT = { '.svg': 'image/svg+xml', '.json': 'application/json' };

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

const ASSET_META = {
  'demo-asset-trademark-mark-1': { kind: 'image', file: 'images/demo-asset-trademark-mark-1.svg' },
  'demo-asset-earth-plate-map-1': { kind: 'image', file: 'images/demo-asset-earth-plate-map-1.svg' },
  'demo-formula-physics-newton-second-law': { kind: 'formula', file: 'formulas/demo-formula-physics-newton-second-law.json' },
};

const sourceAssets = Object.entries(ASSET_META).map(([id, meta]) => {
  const abs = join(ASSETS_DIR, meta.file);
  const buf = readFileSync(abs);
  const ext = meta.file.slice(meta.file.lastIndexOf('.'));
  return {
    id,
    kind: meta.kind,
    path: `assets/${meta.file}`,
    mimeType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    sha256: sha256(buf),
    byteSize: buf.length,
    isSynthetic: true,
    licenseScope: 'test-only',
    sourceLocation: null,
  };
});

// assets/ 아래 실제 파일 수 == ASSET_META 항목 수인지 확인(파일은 있는데 매니페스트에 없는 경우 탐지).
const actualAssetFiles = listFilesRecursive(ASSETS_DIR).map((f) => relative(ASSETS_DIR, f).split('\\').join('/'));
const declaredAssetFiles = Object.values(ASSET_META).map((m) => m.file);
const undeclared = actualAssetFiles.filter((f) => !declaredAssetFiles.includes(f));
if (undeclared.length > 0) {
  console.error('build-package: assets/ 안에 manifest에 선언되지 않은 파일이 있습니다:', undeclared);
  process.exit(1);
}

// --- choice-options.jsonl: choice형 GradingSpec을 쓰는 항목만, 빈 옵션 배열은 제외 ---
const choiceGradingSpecIds = new Set(demoGradingSpecs.filter((s) => s.kind === 'choice').map((s) => s.id));
const choiceItemIds = new Set(
  demoLearningItems.filter((i) => i.gradingSpecId && choiceGradingSpecIds.has(i.gradingSpecId)).map((i) => i.id),
);
const choiceOptions = Object.entries(demoChoiceOptions)
  .filter(([itemId, options]) => choiceItemIds.has(itemId) && options.length > 0)
  .map(([itemId, options]) => ({ itemId, options }));

// --- JSONL 파일 작성 ---
const fileStats = [];
fileStats.push({ name: 'learning-items.jsonl', ...writeJsonl('learning-items.jsonl', demoLearningItems) });
fileStats.push({ name: 'grading-specs.jsonl', ...writeJsonl('grading-specs.jsonl', demoGradingSpecs) });
fileStats.push({ name: 'duration-rules.jsonl', ...writeJsonl('duration-rules.jsonl', demoDurationRules) });
fileStats.push({ name: 'textbook-paragraphs.jsonl', ...writeJsonl('textbook-paragraphs.jsonl', demoTextbookParagraphs) });
fileStats.push({ name: 'content-links.jsonl', ...writeJsonl('content-links.jsonl', demoContentLinks) });
fileStats.push({ name: 'choice-options.jsonl', ...writeJsonl('choice-options.jsonl', choiceOptions) });
fileStats.push({ name: 'source-assets.jsonl', ...writeJsonl('source-assets.jsonl', sourceAssets) });

// --- manifest.json: 위에서 만든 data/*.jsonl + assets/* 전체를 해시/크기와 함께 기록 ---
const manifestFiles = [];
for (const f of fileStats) {
  const buf = readFileSync(f.path);
  manifestFiles.push({
    path: `data/${f.name}`,
    sha256: sha256(buf),
    byteSize: buf.length,
    recordCount: f.recordCount,
  });
}
for (const rel of actualAssetFiles) {
  const buf = readFileSync(join(ASSETS_DIR, rel));
  manifestFiles.push({ path: `assets/${rel}`, sha256: sha256(buf), byteSize: buf.length, recordCount: null });
}

function countBy(records, field) {
  const out = { verified: 0, needsReview: 0, unverified: 0, disputed: 0 };
  const key = { verified: 'verified', needs_review: 'needsReview', unverified: 'unverified', disputed: 'disputed' };
  for (const r of records) {
    const v = field(r);
    if (v && key[v]) out[key[v]] += 1;
  }
  return out;
}

const verifCounts = [
  countBy(demoLearningItems, (i) => i.verification),
  countBy(demoGradingSpecs, (s) => s.verification),
  countBy(demoDurationRules, (d) => d.validity.verification),
].reduce(
  (acc, c) => ({
    verified: acc.verified + c.verified,
    needsReview: acc.needsReview + c.needsReview,
    unverified: acc.unverified + c.unverified,
    disputed: acc.disputed + c.disputed,
  }),
  { verified: 0, needsReview: 0, unverified: 0, disputed: 0 },
);

const subjectIds = [...new Set(demoLearningItems.map((i) => i.subjectId))].sort();

const manifest = {
  schemaVersion: '1.0.0',
  packId: 'hoedokshil-demo-civil-ip-science-v1',
  namespace: 'demo',
  contentVersion: '1.0.0',
  isSynthetic: true,
  subjectIds,
  generatedAt: new Date().toISOString(),
  generatedBy: 'content-package/tools/build-package.mjs (Node.js, src/data/fixtures/demoContent.ts를 단일 소스로 export)',
  licenseScope: 'test-only',
  files: manifestFiles,
  legacyIdMap: {},
  verificationSummary: verifCounts,
};

writeFileSync(join(PKG_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('build-package: 완료');
console.log(`  learningItems=${demoLearningItems.length} gradingSpecs=${demoGradingSpecs.length} durationRules=${demoDurationRules.length}`);
console.log(`  textbookParagraphs=${demoTextbookParagraphs.length} contentLinks=${demoContentLinks.length} choiceOptions=${choiceOptions.length}`);
console.log(`  sourceAssets=${sourceAssets.length}`);
console.log('  manifest.json 작성 완료');
