#!/usr/bin/env node
// 실행: node content-package/tools/generate-review-queue.mjs
//
// 6번 요구사항: 미검증·미연결 항목을 검토 목록에 남긴다.
// 이 스크립트는 "검증됨"을 만들어내지 않는다 - verification 필드가 이미 unverified/
// needs_review/disputed로 표시된 항목과, 구조적으로는 멀쩡하지만 사람이 봐야 하는
// 항목(예: 정답이 없는 GradingSpec)을 목록으로만 뽑는다. 실제 검토는 사람이 한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..');

function readJsonl(rel) {
  return readFileSync(join(PKG_ROOT, rel), 'utf8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

const learningItems = readJsonl('data/learning-items.jsonl');
const gradingSpecs = readJsonl('data/grading-specs.jsonl');
const durationRules = readJsonl('data/duration-rules.jsonl');
const specById = new Map(gradingSpecs.map((s) => [s.id, s]));

const rows = [];

for (const item of learningItems) {
  const spec = item.gradingSpecId ? specById.get(item.gradingSpecId) : null;
  const reasons = [];
  if (item.verification !== 'verified') reasons.push(`항목 자체 verification=${item.verification}`);
  if (spec && spec.verification !== 'verified') reasons.push(`채점기준 verification=${spec.verification}`);
  if (spec?.kind === 'ox' && !spec.correctOxValue) reasons.push('정답(correctOxValue) 미확보');
  if (!spec) reasons.push('채점기준(gradingSpecId) 없음');
  if (reasons.length > 0) {
    rows.push({ kind: 'learning_item', id: item.id, subjectId: item.subjectId, reasons });
  }
}

for (const rule of durationRules) {
  if (rule.validity.verification !== 'verified') {
    rows.push({
      kind: 'duration_rule',
      id: rule.id,
      subjectId: rule.subjectId,
      reasons: [`validity.verification=${rule.validity.verification}`, `whyEvidenceType=${rule.whyEvidenceType}`],
    });
  }
}

const bySubject = new Map();
for (const row of rows) {
  if (!bySubject.has(row.subjectId)) bySubject.set(row.subjectId, []);
  bySubject.get(row.subjectId).push(row);
}

const md = [];
md.push('# REVIEW_QUEUE.md');
md.push('');
md.push('이 목록은 `tools/generate-review-queue.mjs`가 데이터의 `verification` 필드를 그대로 읽어');
md.push('만든 것이다 - 사람이 아직 확인하지 않았거나(`unverified`/`needs_review`), 정답 기준');
md.push('자체가 없는 항목이다. **이 문서에 오른 것은 전부 이번 세션 기준 "완료가 아님"이다.**');
md.push('');
md.push('앱은 `verification !== "verified"` 항목을 자동 채점 퀘스트 후보에서 제외하도록 되어');
md.push('있다(브리핑 7.3, 12.3-2) - 즉 여기 있는 항목은 원문 열람은 가능해도 자동 채점/간격');
md.push('확대에는 쓰이지 않는다.');
md.push('');
md.push(`총 ${rows.length}건 (learning_item ${rows.filter((r) => r.kind === 'learning_item').length}건, duration_rule ${rows.filter((r) => r.kind === 'duration_rule').length}건)`);
md.push('');

for (const [subjectId, items] of [...bySubject.entries()].sort()) {
  md.push(`## ${subjectId} (${items.length}건)`);
  md.push('');
  for (const row of items) {
    md.push(`- **${row.id}** (${row.kind}) — ${row.reasons.join('; ')}`);
  }
  md.push('');
}

md.push('## 참고: 검토가 필요 없는 항목 (기계적으로 통과)');
md.push('');
const cleanCount = learningItems.length - rows.filter((r) => r.kind === 'learning_item').length;
md.push(`- learning_item: ${cleanCount}개는 verification=verified이고 채점기준도 verified다.`);
md.push('  (물리·화학·생물 계산/개념 항목 — 정답이 산술적으로 결정적이라는 뜻이지,');
md.push('  "실제 기출로 확인됨"이라는 뜻은 아니다. 모든 콘텐츠는 여전히 테스트용 가상 자료다.)');
md.push('');
md.push('## 사람이 해야 할 일 (기계가 대신할 수 없음)');
md.push('');
md.push('1. 민법 2건: 판례 법리 설명이 실제 판례 법리와 일치하는지 확인(현재는 가상 설명).');
md.push('2. 특허/실용신안/디자인 5건 + 기간 카드 2건: 실제 조문 번호·기간·기산점으로 교체.');
md.push('3. 상표(`demo-trademark-case-1`): 정답(correctOxValue) 자체가 없음 — 정답 확정 필요.');
md.push('4. 지구과학(`demo-earth-diagram-1`): 판 경계 유형 정답과 이미지가 서로 모순되지');
md.push('   않는지 재확인(이번 세션 중 이미지 방향 오류 1건을 발견해 수정함 — DECISIONS.md 참고).');

writeFileSync(join(PKG_ROOT, 'REVIEW_QUEUE.md'), md.join('\n') + '\n', 'utf8');
console.log(`generate-review-queue: ${rows.length}건 기록`);
