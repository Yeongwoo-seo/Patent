import { addStudyDays, compareStudyDay, minStudyDay } from '../calendar/studyDay';
import { minGapSatisfied } from '../calendar/gap';
import type {
  AnswerPayload,
  Assistance,
  AttemptOutcome,
  Confidence,
  ReviewStage,
  ReviewState,
} from '../types';
import type { ReviewPolicy } from './reviewPolicy';

/** reduceReviewState에 필요한 최소 입력. AttemptEvent에서 파생한다. */
export type GradedAttemptForReview = {
  eventId: string;
  occurredAtUtc: string;
  studyDay: string;
  outcome: AttemptOutcome;
  confidenceBeforeReveal: Confidence;
  assistance: Assistance;
  answer: AnswerPayload;
  requiresIndependentSolve: boolean;
};

export function newReviewState(
  learnerId: string,
  itemId: string,
  learningEpoch: number,
  policyVersion: string,
): ReviewState {
  return {
    learnerId,
    itemId,
    learningEpoch,
    stage: 0,
    dueStudyDay: null,
    lastAttemptEventId: null,
    lastAdvancedAtUtc: null,
    lastAdvancedStudyDay: null,
    lastAnswerExposureAtUtc: null,
    totalAttemptCount: 0,
    incorrectCount: 0,
    unknownCount: 0,
    eligibleReviewCount: 0,
    status: 'new',
    policyVersion,
    projectionVersion: 0,
  };
}

/**
 * 8.6/13.4의 자기보고(self_report)까지 고려한 "도움 없이 풂" 판정.
 * 시스템상 힌트/해설을 보지 않았어도(assistance='none') 사용자가 스스로 '힌트 사용'/'풀이 열람 후 이해'로
 * 자기보고했다면 독립 풀이로 인정하지 않는다.
 */
function derivedIndependentlySolved(assistance: Assistance, answer: AnswerPayload): boolean {
  if (assistance !== 'none') return false;
  if (answer.kind === 'self_report') return answer.value === 'independent';
  return true;
}

/** 새 콘텐츠 리비전을 향한 노출(해설/정답 열람 등)이 발생했음을 기록한다. 간격 확대 조건(11.4-6)에 사용. */
export function recordAnswerExposure(state: ReviewState, exposureAtUtc: string): ReviewState {
  return {
    ...state,
    lastAnswerExposureAtUtc: exposureAtUtc,
    projectionVersion: state.projectionVersion + 1,
  };
}

/**
 * 11.5 상태 전이표 + 11.6 예외를 구현한다.
 * 입력 state가 null이면 "첫 평가"로 취급한다(11.5 첫 행).
 * 정책은 결정적으로 주입되며(11.8) 현재 시각을 별도로 읽지 않는다 — 모든 시각은 이벤트에서 온다.
 */
export function reduceReviewState(
  prev: ReviewState | null,
  ev: GradedAttemptForReview,
  policy: ReviewPolicy,
): ReviewState {
  const base = prev ?? {
    learnerId: '',
    itemId: '',
    learningEpoch: 0,
    stage: 0 as ReviewStage,
    dueStudyDay: null,
    lastAttemptEventId: null,
    lastAdvancedAtUtc: null,
    lastAdvancedStudyDay: null,
    lastAnswerExposureAtUtc: null,
    totalAttemptCount: 0,
    incorrectCount: 0,
    unknownCount: 0,
    eligibleReviewCount: 0,
    status: 'new' as const,
    policyVersion: policy.version,
    projectionVersion: 0,
  };

  const withCounters = (patch: Partial<ReviewState>): ReviewState => ({
    ...base,
    ...patch,
    lastAttemptEventId: ev.eventId,
    totalAttemptCount: base.totalAttemptCount + 1,
    incorrectCount:
      base.incorrectCount + (ev.outcome === 'incorrect' || ev.outcome === 'unknown' ? 1 : 0),
    unknownCount: base.unknownCount + (ev.outcome === 'unknown' ? 1 : 0),
    projectionVersion: base.projectionVersion + 1,
  });

  // 평가 불가/채점 미검증: 미채점으로 기록, 간격 확대 없음 (11.5)
  if (ev.outcome === 'ungraded') {
    return {
      ...base,
      lastAttemptEventId: ev.eventId,
      totalAttemptCount: base.totalAttemptCount + 1,
      projectionVersion: base.projectionVersion + 1,
    };
  }

  const isFirstEvaluation = prev === null || prev.status === 'new';
  const nextStudyDay = addStudyDays(ev.studyDay, 1);

  // 첫 평가: 맞음/틀림/모름/애매 -> 단계 0, 다음 학습일 복습 (11.5 1행)
  if (isFirstEvaluation) {
    return withCounters({
      stage: 0,
      dueStudyDay: nextStudyDay,
      status: 'active',
      policyVersion: policy.version,
    });
  }

  const isCorrect = ev.outcome === 'correct';
  const isConfident = ev.confidenceBeforeReveal === 'sure';
  const noAssistance = ev.assistance === 'none';
  const independentOk = !ev.requiresIndependentSolve || derivedIndependentlySolved(ev.assistance, ev.answer);
  const dueArrived = base.dueStudyDay !== null && compareStudyDay(ev.studyDay, base.dueStudyDay) >= 0;
  const alreadyAdvancedToday = base.lastAdvancedStudyDay === ev.studyDay;
  const referenceForGap = maxUtc(base.lastAdvancedAtUtc, base.lastAnswerExposureAtUtc);
  const gapOk = minGapSatisfied(referenceForGap, ev.occurredAtUtc, policy.minAdvanceGapHours);

  const isValidAdvance =
    isCorrect &&
    isConfident &&
    noAssistance &&
    independentOk &&
    dueArrived &&
    !alreadyAdvancedToday &&
    gapOk;

  // 예정된 유효 복습에서 정답·확실 -> 단계+1, 단계4는 30일 간격 유지 (11.5 2~3행)
  if (isValidAdvance) {
    const newStage = Math.min(base.stage + 1, 4) as ReviewStage;
    const intervalDays = policy.stageIntervalDays[newStage];
    return withCounters({
      stage: newStage,
      dueStudyDay: addStudyDays(ev.studyDay, intervalDays),
      lastAdvancedAtUtc: ev.occurredAtUtc,
      lastAdvancedStudyDay: ev.studyDay,
      eligibleReviewCount: base.eligibleReviewCount + 1,
      status: 'active',
      policyVersion: policy.version,
    });
  }

  // 같은 날 해설 직후 재정답: 시도·당일 확인만 기록, 간격 확대 없음 (11.5, 11.6)
  if (isCorrect && dueArrived && alreadyAdvancedToday) {
    return withCounters({});
  }

  // 오답/모름/애매/추측/힌트 사용 -> 단계 0 (11.5)
  // (예정일 전이면서 정답·확실·독립인 경우는 아래 isFailureLike가 false가 되어
  //  맨 아래 catch-all로 빠지고, "조기 연습 기록, 기존 예정일과 단계 유지"가 된다.)
  const isFailureLike = !isCorrect || !isConfident || !noAssistance || !independentOk;
  if (isFailureLike) {
    const newDue = !dueArrived && base.dueStudyDay ? minStudyDay(nextStudyDay, base.dueStudyDay) : nextStudyDay;
    return withCounters({
      stage: 0,
      dueStudyDay: newDue,
      status: 'active',
      policyVersion: policy.version,
    });
  }

  // 위 분기에 해당하지 않는 경우(정답이나 최소 간격 미충족 등): 시도만 기록
  return withCounters({});
}

function maxUtc(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
