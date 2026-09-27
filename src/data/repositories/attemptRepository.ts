import type { IDBPDatabase } from 'idb';
import { computeStudyDay } from '../../domain/calendar/studyDay';
import { gradeAttempt } from '../../domain/grading/gradeAttempt';
import { reduceReviewState, recordAnswerExposure } from '../../domain/review/reduceReviewState';
import { INITIAL_REVIEW_POLICY } from '../../domain/review/reviewPolicy';
import type {
  AnswerPayload,
  AttemptEvent,
  AttemptSource,
  Assistance,
  Confidence,
  ExposureEvent,
  ExposureKind,
  GradingSpec,
  LearningItem,
} from '../../domain/types';
import type { HoedokshilDB, SyncOutboxEntry } from '../indexeddb/schema';
import { getDb } from '../indexeddb/db';

export type UserSettings = {
  timeZone: string;
  dayBoundaryMinutes: number;
  settingsVersion: string;
};

export const DEFAULT_SETTINGS: UserSettings = {
  timeZone: 'Australia/Sydney',
  dayBoundaryMinutes: 0,
  settingsVersion: 'v1',
};

export type SubmitAttemptInput = {
  learnerId: string;
  deviceId: string;
  deviceSequence: number;
  sessionId: string;
  correlationId: string;
  item: LearningItem;
  gradingSpec: GradingSpec | null;
  answer: AnswerPayload;
  confidenceBeforeReveal: Confidence;
  assistance: Assistance;
  selfReported: boolean;
  activeDurationMs: number;
  errorTags: string[];
  source: AttemptSource;
  mode: string;
  now: () => Date;
  settings?: UserSettings;
};

function newEventId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 19.1 답 제출의 원자성:
 * 하나의 IndexedDB 트랜잭션 안에서 AttemptEvent 추가 + ReviewState 갱신 + SyncOutbox 추가를 처리한다.
 * 네트워크 응답은 이 트랜잭션의 선행 조건이 아니다(동기화는 별도 트리거로 처리, 19.2).
 */
export async function submitAttempt(
  input: SubmitAttemptInput,
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<{ event: AttemptEvent }> {
  const database = db ?? (await getDb());
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const occurredAtUtc = input.now().toISOString();
  const studyDay = computeStudyDay(occurredAtUtc, settings.timeZone, settings.dayBoundaryMinutes);
  const outcome = gradeAttempt(input.gradingSpec, input.answer);

  const event: AttemptEvent = {
    eventId: newEventId(),
    learnerId: input.learnerId,
    deviceId: input.deviceId,
    deviceSequence: input.deviceSequence,
    sessionId: input.sessionId,
    correlationId: input.correlationId,
    itemId: input.item.id,
    contentRevisionId: input.item.contentRevisionId,
    learningEpoch: input.item.learningEpoch,
    gradingSpecId: input.gradingSpec?.id ?? null,
    policyVersion: INITIAL_REVIEW_POLICY.version,
    occurredAtUtc,
    studyDay,
    timeZone: settings.timeZone,
    dayBoundaryMinutes: settings.dayBoundaryMinutes,
    settingsVersion: settings.settingsVersion,
    mode: input.mode,
    answer: input.answer,
    outcome,
    confidenceBeforeReveal: input.confidenceBeforeReveal,
    assistance: input.assistance,
    selfReported: input.selfReported,
    activeDurationMs: input.activeDurationMs,
    errorTags: input.errorTags,
    source: input.source,
  };

  const tx = database.transaction(['attemptEvents', 'reviewStates', 'syncOutbox'], 'readwrite');
  const reviewStore = tx.objectStore('reviewStates');
  const key: [string, string, number] = [input.learnerId, input.item.id, input.item.learningEpoch];
  const prev = (await reviewStore.get(key)) ?? null;

  const nextState = reduceReviewState(
    prev,
    {
      eventId: event.eventId,
      occurredAtUtc: event.occurredAtUtc,
      studyDay: event.studyDay,
      outcome: event.outcome,
      confidenceBeforeReveal: event.confidenceBeforeReveal,
      assistance: event.assistance,
      answer: event.answer,
      requiresIndependentSolve: input.item.requiresIndependentSolve,
    },
    INITIAL_REVIEW_POLICY,
  );
  nextState.learnerId = input.learnerId;
  nextState.itemId = input.item.id;
  nextState.learningEpoch = input.item.learningEpoch;

  const outboxEntry: SyncOutboxEntry = {
    outboxId: `attempt-${event.eventId}`,
    eventId: event.eventId,
    kind: 'attempt',
    createdAtUtc: occurredAtUtc,
    attempts: 0,
    lastError: null,
    status: 'pending',
  };

  await Promise.all([
    tx.objectStore('attemptEvents').add(event),
    reviewStore.put(nextState),
    tx.objectStore('syncOutbox').add(outboxEntry),
  ]);
  await tx.done;

  return { event };
}

export async function recordExposure(
  params: {
    learnerId: string;
    item: LearningItem;
    kind: ExposureKind;
    now: () => Date;
    settings?: UserSettings;
  },
  db?: IDBPDatabase<HoedokshilDB>,
): Promise<void> {
  const database = db ?? (await getDb());
  const settings = params.settings ?? DEFAULT_SETTINGS;
  const occurredAtUtc = params.now().toISOString();
  const studyDay = computeStudyDay(occurredAtUtc, settings.timeZone, settings.dayBoundaryMinutes);

  const event: ExposureEvent = {
    eventId: newEventId(),
    learnerId: params.learnerId,
    itemId: params.item.id,
    contentRevisionId: params.item.contentRevisionId,
    kind: params.kind,
    occurredAtUtc,
    studyDay,
  };

  const tx = database.transaction(['exposureEvents', 'reviewStates'], 'readwrite');
  await tx.objectStore('exposureEvents').add(event);

  // 정답/해설 노출은 11.4-6 최소 간격 계산의 기준 시각으로 반영한다(답안 노출을 힌트 노출로 오인하지 않게
  // occurredAtUtc는 노출 시각 그대로 기록하고, 채점 전 노출 여부 판단은 answer 이벤트가 이 시각과의 순서로 비교한다).
  if (params.kind === 'answer_reveal') {
    const reviewStore = tx.objectStore('reviewStates');
    const key: [string, string, number] = [params.learnerId, params.item.id, params.item.learningEpoch];
    const prev = await reviewStore.get(key);
    if (prev) {
      await reviewStore.put(recordAnswerExposure(prev, occurredAtUtc));
    }
  }
  await tx.done;
}
