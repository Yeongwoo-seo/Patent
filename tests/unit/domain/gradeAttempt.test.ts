import { describe, expect, it } from 'vitest';
import { gradeAttempt } from '@/domain/grading/gradeAttempt';
import type { GradingSpec } from '@/domain/types';

const baseSpec = (overrides: Partial<GradingSpec>): GradingSpec => ({
  id: 'spec-1',
  kind: 'ox',
  verification: 'verified',
  contentRevisionId: 'rev-1',
  ...overrides,
});

describe('gradeAttempt', () => {
  it('returns ungraded when there is no grading spec', () => {
    expect(gradeAttempt(null, { kind: 'ox', value: 'O' })).toBe('ungraded');
  });

  it('returns ungraded when the grading spec is not verified (7.3)', () => {
    const spec = baseSpec({ kind: 'ox', correctOxValue: 'O', verification: 'needs_review' });
    expect(gradeAttempt(spec, { kind: 'ox', value: 'O' })).toBe('ungraded');
  });

  it('grades OX answers against the verified correct value', () => {
    const spec = baseSpec({ kind: 'ox', correctOxValue: 'X' });
    expect(gradeAttempt(spec, { kind: 'ox', value: 'X' })).toBe('correct');
    expect(gradeAttempt(spec, { kind: 'ox', value: 'O' })).toBe('incorrect');
    expect(gradeAttempt(spec, { kind: 'ox', value: 'unknown' })).toBe('unknown');
  });

  it('does not assume the official answer number makes that option true (4.2)', () => {
    // "옳지 않은 것을 고르시오" 문제에서 공식 정답 선지가 '옳음'을 뜻하지 않는다.
    // gradingSpec.correctOptionIds는 "질문에 대한 정답 선택지"이지 참/거짓을 뜻하지 않으므로
    // 채점 엔진은 그 의미를 강제하지 않고 그대로 집합 비교만 수행해야 한다.
    const spec = baseSpec({ kind: 'choice', correctOptionIds: ['opt-3'] });
    expect(gradeAttempt(spec, { kind: 'choice', selectedOptionIds: ['opt-3'] })).toBe('correct');
    expect(gradeAttempt(spec, { kind: 'choice', selectedOptionIds: ['opt-1'] })).toBe('incorrect');
  });

  it('treats an empty choice selection as unknown, not incorrect', () => {
    const spec = baseSpec({ kind: 'choice', correctOptionIds: ['opt-1'] });
    expect(gradeAttempt(spec, { kind: 'choice', selectedOptionIds: [] })).toBe('unknown');
  });

  it('grades numeric answers within the defined tolerance and normalizes units', () => {
    const spec = baseSpec({
      kind: 'numeric',
      numericExpected: 9.8,
      numericAbsoluteTolerance: 0.2,
      expectedUnit: 'm/s^2',
    });
    expect(gradeAttempt(spec, { kind: 'numeric', raw: '9.9', unit: 'M/S^2' })).toBe('correct');
    expect(gradeAttempt(spec, { kind: 'numeric', raw: '9.9', unit: 'm/s' })).toBe('incorrect');
    expect(gradeAttempt(spec, { kind: 'numeric', raw: '11', unit: 'm/s^2' })).toBe('incorrect');
  });

  it('treats an empty numeric answer as unknown, never as zero (8.6 "아직 못 풂")', () => {
    const spec = baseSpec({ kind: 'numeric', numericExpected: 5, numericAbsoluteTolerance: 0.1 });
    expect(gradeAttempt(spec, { kind: 'numeric', raw: '', unit: null })).toBe('unknown');
  });

  it('refuses to auto-grade a numeric spec with no tolerance defined (8.7)', () => {
    const spec = baseSpec({ kind: 'numeric', numericExpected: 9.8 });
    expect(gradeAttempt(spec, { kind: 'numeric', raw: '9.8', unit: null })).toBe('ungraded');
  });

  it('never auto-grades self-reported solves — no eval-style equivalence checking (8.7)', () => {
    const spec = baseSpec({ kind: 'self_report_only' });
    expect(gradeAttempt(spec, { kind: 'self_report', value: 'independent' })).toBe('ungraded');
  });

  it('grades ordered sequence answers exactly', () => {
    const spec = baseSpec({ kind: 'sequence', correctSequence: ['a', 'b', 'c'] });
    expect(gradeAttempt(spec, { kind: 'sequence', orderedIds: ['a', 'b', 'c'] })).toBe('correct');
    expect(gradeAttempt(spec, { kind: 'sequence', orderedIds: ['a', 'c', 'b'] })).toBe('incorrect');
  });
});
