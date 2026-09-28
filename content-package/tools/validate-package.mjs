#!/usr/bin/env node
// 실행: node content-package/tools/validate-package.mjs
// (이 스크립트 자체는 순수 JS라 --experimental-strip-types가 필요 없다.)
//
// 4번 요구사항 구현: 파싱, 중복 ID, 잘못된 참조, 누락 자산을 "코드로" 검사한다.
// 5번 요구사항: 여기서 나오는 결과는 전부 "기계 검증"이다. 조문·판례·계산이 실제로 맞는지
// 같은 "콘텐츠 의미 검수"는 이 스크립트가 할 수 없고, REVIEW_QUEUE.md로 사람에게 넘긴다(6번).
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainstSchema } from './mini-schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..');

const errors = [];
const warnings = [];

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function readJsonlChecked(relPath, schema) {
  const abs = join(PKG_ROOT, relPath);
  if (!existsSync(abs)) {
    errors.push({ check: 'file_exists', file: relPath, message: '파일이 없습니다' });
    return [];
  }
  const raw = readFileSync(abs, 'utf8');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  const records = [];
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (e) {
      errors.push({ check: 'json_parse', file: relPath, line: lineNo, message: e.message });
      return;
    }
    if (schema) {
      const schemaErrors = validateAgainstSchema(schema, parsed);
      for (const msg of schemaErrors) {
        errors.push({ check: 'schema', file: relPath, line: lineNo, id: parsed.id ?? parsed.itemId ?? null, message: msg });
      }
    }
    records.push(parsed);
  });
  return records;
}

function checkDuplicateIds(records, file, idField = 'id') {
  const seen = new Map();
  for (const r of records) {
    const id = r[idField];
    if (id === undefined) continue;
    if (seen.has(id)) {
      errors.push({ check: 'duplicate_id', file, id, message: `중복된 ${idField}: ${id}` });
    }
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
}

// --- 스키마 로드 ---
const schema = (name) => JSON.parse(readFileSync(join(PKG_ROOT, 'schema', name), 'utf8'));
const learningItemSchema = schema('learning-item.schema.json');
const gradingSpecSchema = schema('grading-spec.schema.json');
const durationRuleSchema = schema('duration-rule.schema.json');
const textbookParagraphSchema = schema('textbook-paragraph.schema.json');
const contentLinkSchema = schema('content-link.schema.json');
const sourceAssetSchema = schema('source-asset.schema.json');
const choiceOptionSchema = schema('choice-option.schema.json');
const manifestSchema = schema('manifest.schema.json');

// --- 데이터 로드(파싱+스키마 검증 동시 수행) ---
const learningItems = readJsonlChecked('data/learning-items.jsonl', learningItemSchema);
const gradingSpecs = readJsonlChecked('data/grading-specs.jsonl', gradingSpecSchema);
const durationRules = readJsonlChecked('data/duration-rules.jsonl', durationRuleSchema);
const textbookParagraphs = readJsonlChecked('data/textbook-paragraphs.jsonl', textbookParagraphSchema);
const contentLinks = readJsonlChecked('data/content-links.jsonl', contentLinkSchema);
const sourceAssets = readJsonlChecked('data/source-assets.jsonl', sourceAssetSchema);
const choiceOptions = readJsonlChecked('data/choice-options.jsonl', choiceOptionSchema);

// --- manifest.json 파싱 + 스키마 검증 ---
let manifest = null;
if (existsSync(join(PKG_ROOT, 'manifest.json'))) {
  try {
    manifest = JSON.parse(readFileSync(join(PKG_ROOT, 'manifest.json'), 'utf8'));
    for (const msg of validateAgainstSchema(manifestSchema, manifest)) {
      errors.push({ check: 'schema', file: 'manifest.json', message: msg });
    }
  } catch (e) {
    errors.push({ check: 'json_parse', file: 'manifest.json', message: e.message });
  }
} else {
  errors.push({ check: 'file_exists', file: 'manifest.json', message: '파일이 없습니다' });
}

// --- 중복 ID ---
checkDuplicateIds(learningItems, 'data/learning-items.jsonl');
checkDuplicateIds(gradingSpecs, 'data/grading-specs.jsonl');
checkDuplicateIds(durationRules, 'data/duration-rules.jsonl');
checkDuplicateIds(textbookParagraphs, 'data/textbook-paragraphs.jsonl');
checkDuplicateIds(contentLinks, 'data/content-links.jsonl');
checkDuplicateIds(sourceAssets, 'data/source-assets.jsonl');
checkDuplicateIds(choiceOptions, 'data/choice-options.jsonl', 'itemId');

// --- 참조 무결성 ---
const itemIds = new Set(learningItems.map((i) => i.id));
const paragraphIds = new Set(textbookParagraphs.map((p) => p.id));
const gradingSpecIds = new Set(gradingSpecs.map((s) => s.id));
const assetIds = new Set(sourceAssets.map((a) => a.id));
const itemOrParagraphIds = new Set([...itemIds, ...paragraphIds]);

for (const item of learningItems) {
  if (item.gradingSpecId !== null && item.gradingSpecId !== undefined && !gradingSpecIds.has(item.gradingSpecId)) {
    errors.push({ check: 'broken_reference', file: 'data/learning-items.jsonl', id: item.id, message: `gradingSpecId '${item.gradingSpecId}' 를 찾을 수 없음` });
  }
  for (const relId of item.relatedItemIds ?? []) {
    if (!itemIds.has(relId)) {
      errors.push({ check: 'broken_reference', file: 'data/learning-items.jsonl', id: item.id, message: `relatedItemIds '${relId}' 를 찾을 수 없음` });
    }
  }
  for (const assetId of item.requiredAssetIds ?? []) {
    if (!assetIds.has(assetId)) {
      errors.push({ check: 'missing_asset', file: 'data/learning-items.jsonl', id: item.id, message: `requiredAssetIds '${assetId}' 가 source-assets.jsonl에 없음` });
    }
  }
}

for (const paragraph of textbookParagraphs) {
  for (const assetId of paragraph.assetIds ?? []) {
    if (!assetIds.has(assetId)) {
      errors.push({ check: 'missing_asset', file: 'data/textbook-paragraphs.jsonl', id: paragraph.id, message: `assetIds '${assetId}' 가 source-assets.jsonl에 없음` });
    }
  }
}

for (const link of contentLinks) {
  if (!itemOrParagraphIds.has(link.fromId)) {
    errors.push({ check: 'broken_reference', file: 'data/content-links.jsonl', id: link.id, message: `fromId '${link.fromId}' 를 찾을 수 없음` });
  }
  if (!itemOrParagraphIds.has(link.toId)) {
    errors.push({ check: 'broken_reference', file: 'data/content-links.jsonl', id: link.id, message: `toId '${link.toId}' 를 찾을 수 없음` });
  }
}

for (const co of choiceOptions) {
  if (!itemIds.has(co.itemId)) {
    errors.push({ check: 'broken_reference', file: 'data/choice-options.jsonl', id: co.itemId, message: `itemId '${co.itemId}' 가 learning-items.jsonl에 없음` });
  }
}

// choice형 GradingSpec의 정답 ID가 실제 선택지 목록 안에 있는지 (앱에서 실제로 겪었던 버그 재발 방지)
const choiceOptionsByItem = new Map(choiceOptions.map((co) => [co.itemId, new Set(co.options.map((o) => o.id))]));
for (const item of learningItems) {
  const spec = gradingSpecs.find((s) => s.id === item.gradingSpecId);
  if (spec?.kind === 'choice') {
    const optionIds = choiceOptionsByItem.get(item.id);
    if (!optionIds) {
      errors.push({ check: 'missing_choice_options', file: 'data/choice-options.jsonl', id: item.id, message: '선택형 문항인데 choice-options.jsonl에 선택지가 없음' });
    } else {
      for (const correctId of spec.correctOptionIds ?? []) {
        if (!optionIds.has(correctId)) {
          errors.push({ check: 'invalid_correct_option', file: 'data/grading-specs.jsonl', id: spec.id, message: `correctOptionIds '${correctId}' 가 choice-options.jsonl의 선택지 목록에 없음` });
        }
      }
    }
  }
}

// --- 자산 파일 실재 여부 + 해시 일치 ---
for (const asset of sourceAssets) {
  const abs = join(PKG_ROOT, asset.path);
  if (!existsSync(abs)) {
    errors.push({ check: 'missing_asset_file', file: asset.path, id: asset.id, message: '선언된 자산 파일이 디스크에 없음' });
    continue;
  }
  const buf = readFileSync(abs);
  const actualHash = sha256(buf);
  if (actualHash !== asset.sha256) {
    errors.push({ check: 'hash_mismatch', file: asset.path, id: asset.id, message: `sha256 불일치 (기록 ${asset.sha256}, 실제 ${actualHash})` });
  }
  if (buf.length !== asset.byteSize) {
    errors.push({ check: 'size_mismatch', file: asset.path, id: asset.id, message: `byteSize 불일치 (기록 ${asset.byteSize}, 실제 ${buf.length})` });
  }
}

// --- manifest.json의 files[] 선언과 실제 파일 재계산 값 대조(변조/구버전 탐지) ---
if (manifest) {
  for (const entry of manifest.files ?? []) {
    const abs = join(PKG_ROOT, entry.path);
    if (!existsSync(abs)) {
      errors.push({ check: 'manifest_file_missing', file: entry.path, message: 'manifest.json에 선언되었지만 실제 파일이 없음' });
      continue;
    }
    const buf = readFileSync(abs);
    const actualHash = sha256(buf);
    if (actualHash !== entry.sha256) {
      errors.push({ check: 'manifest_hash_mismatch', file: entry.path, message: `manifest.json의 sha256과 실제 파일이 다름 (재빌드 필요할 수 있음)` });
    }
    if (buf.length !== entry.byteSize) {
      errors.push({ check: 'manifest_size_mismatch', file: entry.path, message: `manifest.json의 byteSize와 실제 파일 크기가 다름` });
    }
  }
}

// --- 고아 자산(참조되지 않는 자산) — 오류 아님, 경고만 ---
const referencedAssetIds = new Set([
  ...learningItems.flatMap((i) => i.requiredAssetIds ?? []),
  ...textbookParagraphs.flatMap((p) => p.assetIds ?? []),
]);
for (const asset of sourceAssets) {
  if (!referencedAssetIds.has(asset.id)) {
    warnings.push({ check: 'orphan_asset', file: asset.path, id: asset.id, message: '어떤 학습 항목/문단에서도 참조하지 않는 자산' });
  }
}

// --- 결과 집계 ---
const summary = {
  generatedAt: new Date().toISOString(),
  tool: 'content-package/tools/validate-package.mjs',
  recordCounts: {
    learningItems: learningItems.length,
    gradingSpecs: gradingSpecs.length,
    durationRules: durationRules.length,
    textbookParagraphs: textbookParagraphs.length,
    contentLinks: contentLinks.length,
    choiceOptions: choiceOptions.length,
    sourceAssets: sourceAssets.length,
  },
  errorCount: errors.length,
  warningCount: warnings.length,
  ok: errors.length === 0,
};

const report = { summary, errors, warnings };
writeFileSync(join(PKG_ROOT, 'VALIDATION_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

const md = [];
md.push('# VALIDATION_REPORT.md');
md.push('');
md.push('**이 문서는 기계 검증 결과만 담는다.** 콘텐츠(법률/과학) 의미가 실제로 맞는지는');
md.push('여기서 확인하지 않는다 — 그 목록은 `REVIEW_QUEUE.md`를 본다.');
md.push('');
md.push(`생성 시각(UTC): ${summary.generatedAt}`);
md.push('');
md.push('## 레코드 수');
md.push('');
for (const [k, v] of Object.entries(summary.recordCounts)) md.push(`- ${k}: ${v}`);
md.push('');
md.push(`## 결과: ${summary.ok ? '✅ 통과 (오류 0)' : `❌ 오류 ${summary.errorCount}건`}`);
md.push('');
md.push(`- 오류: ${errors.length}건`);
md.push(`- 경고(오류 아님): ${warnings.length}건`);
md.push('');
if (errors.length > 0) {
  md.push('## 오류 목록');
  md.push('');
  for (const e of errors) {
    md.push(`- [${e.check}] ${e.file}${e.line ? `:${e.line}` : ''}${e.id ? ` (id=${e.id})` : ''} — ${e.message}`);
  }
  md.push('');
}
if (warnings.length > 0) {
  md.push('## 경고 목록');
  md.push('');
  for (const w of warnings) {
    md.push(`- [${w.check}] ${w.file} (id=${w.id}) — ${w.message}`);
  }
  md.push('');
}
md.push('## 검사 항목 (코드로 수행)');
md.push('');
md.push('- JSON 파싱 (`json_parse`)');
md.push('- 스키마 필수 필드/타입/enum (`schema`, `schema/*.schema.json` 기준)');
md.push('- 컬렉션 내 ID 중복 (`duplicate_id`)');
md.push('- 항목 간 참조 무결성: gradingSpecId, relatedItemIds, ContentLink.fromId/toId (`broken_reference`)');
md.push('- 선택형 문항의 정답 ID가 실제 선택지 목록에 있는지 (`invalid_correct_option`, `missing_choice_options`)');
md.push('- 필수 자산 참조가 source-assets.jsonl에 존재하는지 (`missing_asset`)');
md.push('- 자산 파일이 디스크에 실재하는지 + sha256/크기 일치 (`missing_asset_file`, `hash_mismatch`, `size_mismatch`)');
md.push('- manifest.json에 선언된 해시/크기가 실제 파일과 일치하는지 (`manifest_hash_mismatch`, `manifest_size_mismatch`)');
md.push('- 참조되지 않는 고아 자산 (`orphan_asset`, 경고)');
md.push('');
md.push('## 이 스크립트가 검증하지 못하는 것');
md.push('');
md.push('- 조문/판례/계산의 실제 정오 (콘텐츠 의미) — `REVIEW_QUEUE.md`');
md.push('- 이미지가 문제 의도와 실제로 맞는지(예: 그림이 정답과 모순되지 않는지)');
md.push('- 저작권/라이선스 적법성');

writeFileSync(join(PKG_ROOT, 'VALIDATION_REPORT.md'), md.join('\n') + '\n', 'utf8');

console.log(`validate-package: 오류 ${errors.length}건, 경고 ${warnings.length}건`);
if (errors.length > 0) {
  for (const e of errors) console.error(' -', e.check, e.file, e.id ?? '', '-', e.message);
  process.exitCode = 1;
}
