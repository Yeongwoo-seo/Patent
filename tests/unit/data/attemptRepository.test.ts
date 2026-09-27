import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb, closeDb } from '@/data/indexeddb/db';
import { DB_NAME } from '@/data/indexeddb/schema';
import { submitAttempt, recordExposure } from '@/data/repositories/attemptRepository';
import type { GradingSpec, LearningItem } from '@/domain/types';

const item: LearningItem = {
  id: 'civil-item-1',
  subjectId: 'civil',
  kind: 'legal_statement',
  sourceContentId: 'src-1',
  contentRevisionId: 'rev-1',
  learningEpoch: 0,
  topicIds: ['topic-1'],
  relatedItemIds: [],
  requiredAssetIds: [],
  availableContexts: ['micro'],
  canStandaloneOX: true,
  requiresIndependentSolve: false,
  gradingSpecId: 'spec-1',
  verification: 'verified',
  isSynthetic: true,
  prompt: '(테스트용 가상 자료) 신의칙 관련 명제',
};

const spec: GradingSpec = {
  id: 'spec-1',
  kind: 'ox',
  correctOxValue: 'O',
  verification: 'verified',
  contentRevisionId: 'rev-1',
};

function fixedNow(iso: string) {
  return () => new Date(iso);
}

beforeEach(async () => {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
});

afterEach(async () => {
  await closeDb();
});

describe('submitAttempt (19.1 atomicity)', () => {
  it('writes the attempt event and derives the review state in one pass', async () => {
    const db = await getDb();
    const { event } = await submitAttempt({
      learnerId: 'local',
      deviceId: 'device-a',
      deviceSequence: 1,
      sessionId: 'sess-1',
      correlationId: 'corr-1',
      item,
      gradingSpec: spec,
      answer: { kind: 'ox', value: 'O' },
      confidenceBeforeReveal: 'sure',
      assistance: 'none',
      selfReported: false,
      activeDurationMs: 4000,
      errorTags: [],
      source: 'manual_answer',
      mode: 'ox_review',
      now: fixedNow('2026-09-28T01:00:00.000Z'),
    }, db);

    expect(event.outcome).toBe('correct');

    const storedEvent = await db.get('attemptEvents', event.eventId);
    expect(storedEvent).toBeDefined();

    const state = await db.get('reviewStates', ['local', item.id, 0]);
    expect(state?.stage).toBe(0);
    expect(state?.dueStudyDay).toBe('2026-09-29');
    expect(state?.totalAttemptCount).toBe(1);

    const outboxAll = await db.getAll('syncOutbox');
    expect(outboxAll).toHaveLength(1);
    expect(outboxAll[0]?.eventId).toBe(event.eventId);
  });

  it('advances the stage on a second, later, confident correct answer once due', async () => {
    const db = await getDb();
    await submitAttempt({
      learnerId: 'local',
      deviceId: 'device-a',
      deviceSequence: 1,
      sessionId: 'sess-1',
      correlationId: 'corr-1',
      item,
      gradingSpec: spec,
      answer: { kind: 'ox', value: 'X' },
      confidenceBeforeReveal: 'sure',
      assistance: 'none',
      selfReported: false,
      activeDurationMs: 4000,
      errorTags: [],
      source: 'manual_answer',
      mode: 'ox_review',
      now: fixedNow('2026-09-28T01:00:00.000Z'),
    }, db);

    await submitAttempt({
      learnerId: 'local',
      deviceId: 'device-a',
      deviceSequence: 2,
      sessionId: 'sess-2',
      correlationId: 'corr-2',
      item,
      gradingSpec: spec,
      answer: { kind: 'ox', value: 'O' },
      confidenceBeforeReveal: 'sure',
      assistance: 'none',
      selfReported: false,
      activeDurationMs: 4000,
      errorTags: [],
      source: 'manual_answer',
      mode: 'ox_review',
      now: fixedNow('2026-09-29T01:00:00.000Z'),
    }, db);

    const state = await db.get('reviewStates', ['local', item.id, 0]);
    expect(state?.stage).toBe(1);
    expect(state?.dueStudyDay).toBe('2026-10-02');
    expect(state?.totalAttemptCount).toBe(2);
  });

  it('does not treat an unverified grading spec as gradeable (ungraded, no schedule change)', async () => {
    const db = await getDb();
    const unverifiedSpec: GradingSpec = { ...spec, verification: 'needs_review' };
    const { event } = await submitAttempt({
      learnerId: 'local',
      deviceId: 'device-a',
      deviceSequence: 1,
      sessionId: 'sess-1',
      correlationId: 'corr-1',
      item,
      gradingSpec: unverifiedSpec,
      answer: { kind: 'ox', value: 'O' },
      confidenceBeforeReveal: 'sure',
      assistance: 'none',
      selfReported: false,
      activeDurationMs: 4000,
      errorTags: [],
      source: 'manual_answer',
      mode: 'ox_review',
      now: fixedNow('2026-09-28T01:00:00.000Z'),
    }, db);

    expect(event.outcome).toBe('ungraded');
    const state = await db.get('reviewStates', ['local', item.id, 0]);
    expect(state?.dueStudyDay).toBeNull();
  });
});

describe('recordExposure', () => {
  it('records an answer_reveal exposure and updates lastAnswerExposureAtUtc on the review state', async () => {
    const db = await getDb();
    await submitAttempt({
      learnerId: 'local',
      deviceId: 'device-a',
      deviceSequence: 1,
      sessionId: 'sess-1',
      correlationId: 'corr-1',
      item,
      gradingSpec: spec,
      answer: { kind: 'ox', value: 'X' },
      confidenceBeforeReveal: 'sure',
      assistance: 'none',
      selfReported: false,
      activeDurationMs: 4000,
      errorTags: [],
      source: 'manual_answer',
      mode: 'ox_review',
      now: fixedNow('2026-09-28T01:00:00.000Z'),
    }, db);

    await recordExposure({
      learnerId: 'local',
      item,
      kind: 'answer_reveal',
      now: fixedNow('2026-09-28T01:00:05.000Z'),
    }, db);

    const state = await db.get('reviewStates', ['local', item.id, 0]);
    expect(state?.lastAnswerExposureAtUtc).toBe('2026-09-28T01:00:05.000Z');
  });
});
