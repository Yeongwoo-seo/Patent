import { describe, expect, it } from 'vitest';
import { newReviewState, reduceReviewState, type GradedAttemptForReview } from '@/domain/review/reduceReviewState';
import { INITIAL_REVIEW_POLICY } from '@/domain/review/reviewPolicy';
import type { ReviewState } from '@/domain/types';

const policy = INITIAL_REVIEW_POLICY;

function attempt(overrides: Partial<GradedAttemptForReview> & { studyDay: string; occurredAtUtc: string }): GradedAttemptForReview {
  return {
    eventId: `ev-${overrides.studyDay}-${Math.random()}`,
    outcome: 'correct',
    confidenceBeforeReveal: 'sure',
    assistance: 'none',
    answer: { kind: 'ox', value: 'O' },
    requiresIndependentSolve: false,
    ...overrides,
  };
}

// 11.7 고정 테스트 예시 — 시간대/하루 경계 고정, 각 복습 사이 8시간 이상 가정.
describe('reduceReviewState — 11.7 fixed test vector', () => {
  it('reproduces the documented stage/due sequence exactly', () => {
    let state: ReviewState | null = null;

    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-09-28', occurredAtUtc: '2026-09-28T01:00:00Z', outcome: 'incorrect' }),
      policy,
    );
    expect(state.stage).toBe(0);
    expect(state.dueStudyDay).toBe('2026-09-29');

    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-09-29', occurredAtUtc: '2026-09-29T01:00:00Z', outcome: 'correct' }),
      policy,
    );
    expect(state.stage).toBe(1);
    expect(state.dueStudyDay).toBe('2026-10-02');

    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T01:00:00Z', outcome: 'correct' }),
      policy,
    );
    expect(state.stage).toBe(2);
    expect(state.dueStudyDay).toBe('2026-10-09');

    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-09', occurredAtUtc: '2026-10-09T01:00:00Z', outcome: 'incorrect' }),
      policy,
    );
    expect(state.stage).toBe(0);
    expect(state.dueStudyDay).toBe('2026-10-10');

    // 즉시 재정답 (같은 날, 8시간 이내) — 실패로 만든 다음 날 일정을 취소하지 않는다.
    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-09', occurredAtUtc: '2026-10-09T02:00:00Z', outcome: 'correct' }),
      policy,
    );
    expect(state.stage).toBe(0);
    expect(state.dueStudyDay).toBe('2026-10-10');
  });
});

describe('reduceReviewState — stage ceiling', () => {
  it('keeps a 30-day interval once stage 4 is reached (11.5)', () => {
    const stage4: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 4,
      status: 'active',
      dueStudyDay: '2026-11-01',
      lastAdvancedAtUtc: '2026-10-01T00:00:00Z',
      lastAdvancedStudyDay: '2026-10-01',
    };
    const next = reduceReviewState(
      stage4,
      attempt({ studyDay: '2026-11-01', occurredAtUtc: '2026-11-01T09:00:00Z' }),
      policy,
    );
    expect(next.stage).toBe(4);
    expect(next.dueStudyDay).toBe('2026-12-01');
  });
});

describe('reduceReviewState — minimum gap (11.4 condition 6, 8h default)', () => {
  it('does not advance the stage if the gap since the last advance is under the policy minimum', () => {
    const afterFirstAdvance: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
      lastAdvancedAtUtc: '2026-10-01T20:00:00Z',
      lastAdvancedStudyDay: '2026-10-01',
    };
    // 예정일은 도래했지만 직전 유효 평가로부터 8시간이 지나지 않았다(4.5시간).
    const next = reduceReviewState(
      afterFirstAdvance,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T00:30:00Z' }),
      policy,
    );
    expect(next.stage).toBe(1);
    expect(next.dueStudyDay).toBe('2026-10-02');
  });
});

describe('reduceReviewState — same studyDay never advances twice', () => {
  it('caps eligible advances to once per studyDay even with two valid devices/events', () => {
    let state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T01:00:00Z' }),
      policy,
    );
    expect(state.stage).toBe(2);
    const dueAfterFirstAdvance = state.dueStudyDay;

    // 같은 studyDay 안의 두 번째 기기에서 온 또 다른 유효해 보이는 정답 — 단계가 두 번 오르면 안 된다.
    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T20:00:00Z' }),
      policy,
    );
    expect(state.stage).toBe(2);
    expect(state.dueStudyDay).toBe(dueAfterFirstAdvance);
  });

  it('prioritizes a same-day failure over an earlier same-day success (11.6)', () => {
    let state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T01:00:00Z', outcome: 'correct' }),
      policy,
    );
    expect(state.stage).toBe(2);

    state = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T20:00:00Z', outcome: 'incorrect' }),
      policy,
    );
    expect(state.stage).toBe(0);
    expect(state.dueStudyDay).toBe('2026-10-03');
  });
});

describe('reduceReviewState — early (pre-due) attempts', () => {
  it('records an early independent correct attempt without changing stage or due date', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
      lastAdvancedAtUtc: '2026-09-29T01:00:00Z',
      lastAdvancedStudyDay: '2026-09-29',
    };
    const next = reduceReviewState(
      state,
      attempt({ studyDay: '2026-09-30', occurredAtUtc: '2026-09-30T10:00:00Z', outcome: 'correct' }),
      policy,
    );
    expect(next.stage).toBe(1);
    expect(next.dueStudyDay).toBe('2026-10-02');
    expect(next.totalAttemptCount).toBe(1);
  });

  it('pulls an early incorrect/ambiguous attempt forward but never later than the existing due date', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    const next = reduceReviewState(
      state,
      attempt({ studyDay: '2026-09-30', occurredAtUtc: '2026-09-30T10:00:00Z', outcome: 'incorrect' }),
      policy,
    );
    expect(next.stage).toBe(0);
    expect(next.dueStudyDay).toBe('2026-10-01');
  });

  it('does not push the due date later than it already was when pulling forward', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-09-30', // 다음날(10-01)보다 이른 기존 예정일
    };
    const next = reduceReviewState(
      state,
      attempt({ studyDay: '2026-09-29', occurredAtUtc: '2026-09-29T10:00:00Z', outcome: 'incorrect' }),
      policy,
    );
    expect(next.dueStudyDay).toBe('2026-09-30');
  });
});

describe('reduceReviewState — confidence/assistance gates (11.4 conditions 3-4)', () => {
  it('treats a correct-but-unsure due-date answer like a failure (initial conservative policy, 11.5)', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    const next = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T01:00:00Z', confidenceBeforeReveal: 'unsure' }),
      policy,
    );
    expect(next.stage).toBe(0);
    expect(next.dueStudyDay).toBe('2026-10-03');
  });

  it('does not advance the stage if the solution/hint was seen before submitting (assistance != none)', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    const next = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T01:00:00Z', assistance: 'hint' }),
      policy,
    );
    expect(next.stage).toBe(0);
  });
});

describe('reduceReviewState — independent solve requirement (3.3.5, 8.1)', () => {
  it('does not advance an independent-solve item when the self-report says "assisted"', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'physics-calc-1', 0, policy.version),
      stage: 0,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    const next = reduceReviewState(
      state,
      attempt({
        studyDay: '2026-10-02',
        occurredAtUtc: '2026-10-02T01:00:00Z',
        requiresIndependentSolve: true,
        answer: { kind: 'self_report', value: 'assisted' },
      }),
      policy,
    );
    expect(next.stage).toBe(0);
    expect(next.dueStudyDay).toBe('2026-10-03');
  });

  it('advances an independent-solve item only when self-reported as independent', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'physics-calc-1', 0, policy.version),
      stage: 0,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    const next = reduceReviewState(
      state,
      attempt({
        studyDay: '2026-10-02',
        occurredAtUtc: '2026-10-02T01:00:00Z',
        requiresIndependentSolve: true,
        answer: { kind: 'self_report', value: 'independent' },
      }),
      policy,
    );
    expect(next.stage).toBe(1);
  });
});

describe('reduceReviewState — ungraded attempts never move the schedule (4.3, 7.3)', () => {
  it('leaves stage and due date untouched but records the attempt', () => {
    const state: ReviewState = {
      ...newReviewState('u1', 'item1', 0, policy.version),
      stage: 1,
      status: 'active',
      dueStudyDay: '2026-10-02',
    };
    const next = reduceReviewState(
      state,
      attempt({ studyDay: '2026-10-02', occurredAtUtc: '2026-10-02T01:00:00Z', outcome: 'ungraded' }),
      policy,
    );
    expect(next.stage).toBe(1);
    expect(next.dueStudyDay).toBe('2026-10-02');
    expect(next.totalAttemptCount).toBe(1);
  });
});
