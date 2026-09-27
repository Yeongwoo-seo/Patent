import type { AnswerPayload, AttemptOutcome, GradingSpec } from '../types';

/**
 * 8.7 채점 규칙 + 4.3 ungraded 규칙 구현.
 *
 * - 채점 기준(GradingSpec)이 없거나 'verified'가 아니면 채점하지 않는다(ungraded).
 *   현재 기준 미검증 항목을 자동 채점·간격 확대에 사용하지 않기 위함(7.3).
 * - 수식 동치 판정처럼 검증된 엔진이 없는 유형은 채점하지 않고 자기보고로만 남긴다.
 * - 단위가 필요한 수치 문제는 단위 불일치를 별도로 오답 처리한다.
 */
export function gradeAttempt(gradingSpec: GradingSpec | null, answer: AnswerPayload): AttemptOutcome {
  if (gradingSpec === null) return 'ungraded';
  if (gradingSpec.verification !== 'verified') return 'ungraded';

  switch (gradingSpec.kind) {
    case 'ox':
      return gradeOx(gradingSpec, answer);
    case 'choice':
      return gradeChoice(gradingSpec, answer);
    case 'numeric':
      return gradeNumeric(gradingSpec, answer);
    case 'cloze':
      return gradeCloze(gradingSpec, answer);
    case 'sequence':
      return gradeSequence(gradingSpec, answer);
    case 'self_report_only':
      // 자기보고는 정오를 자동 검증하지 않는다. selfReported 플래그로 이력만 남긴다.
      return 'ungraded';
    default:
      return 'ungraded';
  }
}

function requireKind<K extends AnswerPayload['kind']>(
  answer: AnswerPayload,
  kind: K,
): Extract<AnswerPayload, { kind: K }> {
  if (answer.kind !== kind) {
    throw new Error(`gradeAttempt: expected answer.kind="${kind}" but got "${answer.kind}"`);
  }
  return answer as Extract<AnswerPayload, { kind: K }>;
}

function gradeOx(spec: GradingSpec, answerRaw: AnswerPayload): AttemptOutcome {
  const answer = requireKind(answerRaw, 'ox');
  if (answer.value === 'unknown') return 'unknown';
  if (!spec.correctOxValue) return 'ungraded';
  return answer.value === spec.correctOxValue ? 'correct' : 'incorrect';
}

function gradeChoice(spec: GradingSpec, answerRaw: AnswerPayload): AttemptOutcome {
  const answer = requireKind(answerRaw, 'choice');
  if (!spec.correctOptionIds || spec.correctOptionIds.length === 0) return 'ungraded';
  if (answer.selectedOptionIds.length === 0) return 'unknown';
  const expected = new Set(spec.correctOptionIds);
  const actual = new Set(answer.selectedOptionIds);
  if (expected.size !== actual.size) return 'incorrect';
  for (const id of expected) if (!actual.has(id)) return 'incorrect';
  return 'correct';
}

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

function gradeNumeric(spec: GradingSpec, answerRaw: AnswerPayload): AttemptOutcome {
  const answer = requireKind(answerRaw, 'numeric');
  if (spec.numericExpected === undefined) return 'ungraded';
  if (answer.raw.trim() === '') return 'unknown';
  const value = Number(answer.raw);
  if (Number.isNaN(value)) return 'unknown';

  if (spec.expectedUnit) {
    if (!answer.unit) return 'incorrect';
    if (normalizeUnit(answer.unit) !== normalizeUnit(spec.expectedUnit)) return 'incorrect';
  }

  const absTol = spec.numericAbsoluteTolerance ?? 0;
  const relTol = spec.numericRelativeTolerance ?? 0;
  const diff = Math.abs(value - spec.numericExpected);
  const allowed = Math.max(absTol, Math.abs(spec.numericExpected) * relTol);
  if (absTol === 0 && relTol === 0) {
    // 허용오차가 정의되지 않은 수치형은 자동 채점하지 않는다(8.7).
    return 'ungraded';
  }
  return diff <= allowed ? 'correct' : 'incorrect';
}

function gradeCloze(spec: GradingSpec, answerRaw: AnswerPayload): AttemptOutcome {
  const answer = requireKind(answerRaw, 'cloze');
  if (!spec.correctClozeValues) return 'ungraded';
  const keys = Object.keys(spec.correctClozeValues);
  if (keys.length === 0) return 'ungraded';
  let allBlank = true;
  for (const key of keys) {
    const given = (answer.values[key] ?? '').trim();
    if (given.length > 0) allBlank = false;
    const expected = spec.correctClozeValues[key]!.trim();
    if (given.toLowerCase() !== expected.toLowerCase()) {
      return allBlank && key === keys[keys.length - 1] ? 'unknown' : 'incorrect';
    }
  }
  return 'correct';
}

function gradeSequence(spec: GradingSpec, answerRaw: AnswerPayload): AttemptOutcome {
  const answer = requireKind(answerRaw, 'sequence');
  if (!spec.correctSequence || spec.correctSequence.length === 0) return 'ungraded';
  if (answer.orderedIds.length === 0) return 'unknown';
  if (answer.orderedIds.length !== spec.correctSequence.length) return 'incorrect';
  for (let i = 0; i < spec.correctSequence.length; i++) {
    if (answer.orderedIds[i] !== spec.correctSequence[i]) return 'incorrect';
  }
  return 'correct';
}
