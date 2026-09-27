import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from '@/domain/quest/buildDailyPlan';
import { newReviewState } from '@/domain/review/reduceReviewState';
import type { LearningItem, ReviewState } from '@/domain/types';

function item(overrides: Partial<LearningItem> & Pick<LearningItem, 'id' | 'subjectId' | 'kind'>): LearningItem {
  return {
    sourceContentId: overrides.id,
    contentRevisionId: 'rev-1',
    learningEpoch: 0,
    topicIds: [],
    relatedItemIds: [],
    requiredAssetIds: [],
    availableContexts: ['micro', 'focused'],
    canStandaloneOX: true,
    requiresIndependentSolve: false,
    gradingSpecId: null,
    verification: 'verified',
    isSynthetic: true,
    prompt: 'test',
    ...overrides,
  };
}

const civilItem = item({ id: 'c1', subjectId: 'civil', kind: 'legal_statement' });
const patentItem = item({ id: 'p1', subjectId: 'patent', kind: 'procedure' });
const physicsNew = item({ id: 'ph1', subjectId: 'physics', kind: 'concept_ox' });
const physicsIndependentMicroExcluded = item({
  id: 'ph2',
  subjectId: 'physics',
  kind: 'independent_problem',
  availableContexts: ['focused'],
  requiresIndependentSolve: true,
});

function dueState(itemId: string, incorrect = 0, unknown = 0): ReviewState {
  return {
    ...newReviewState('local', itemId, 0, 'v1'),
    status: 'active',
    stage: 0,
    dueStudyDay: '2026-09-28',
    incorrectCount: incorrect,
    unknownCount: unknown,
  };
}

describe('buildDailyPlan', () => {
  it('splits the time budget evenly across the three subject groups by default (12.4)', () => {
    const plan = buildDailyPlan({
      learnerId: 'local',
      studyDay: '2026-09-28',
      planVersion: 1,
      generatedAtUtc: '2026-09-28T00:00:00Z',
      availableMinutes: 30,
      currentContext: 'focused',
      items: [civilItem, patentItem, physicsNew],
      reviewStates: new Map(),
    });
    expect(plan.subjectGroupBudgetMinutes.civil_law).toBe(10);
    expect(plan.subjectGroupBudgetMinutes.ip_law).toBe(10);
    expect(plan.subjectGroupBudgetMinutes.science).toBe(10);
  });

  it('reallocates an empty subject group budget to groups that have candidates (12.4)', () => {
    const plan = buildDailyPlan({
      learnerId: 'local',
      studyDay: '2026-09-28',
      planVersion: 1,
      generatedAtUtc: '2026-09-28T00:00:00Z',
      availableMinutes: 30,
      currentContext: 'focused',
      items: [civilItem, patentItem], // no science candidates
      reviewStates: new Map(),
    });
    expect(plan.subjectGroupBudgetMinutes.science).toBe(0);
    expect(plan.subjectGroupBudgetMinutes.civil_law).toBe(15);
    expect(plan.subjectGroupBudgetMinutes.ip_law).toBe(15);
    expect(plan.excludedReasons.some((r) => r.includes('science'))).toBe(true);
  });

  it('excludes items not available in the current context (micro excludes focused-only independent problems)', () => {
    const plan = buildDailyPlan({
      learnerId: 'local',
      studyDay: '2026-09-28',
      planVersion: 1,
      generatedAtUtc: '2026-09-28T00:00:00Z',
      availableMinutes: 30,
      currentContext: 'micro',
      items: [physicsIndependentMicroExcluded],
      reviewStates: new Map(),
    });
    expect(plan.items).toHaveLength(0);
  });

  it('prioritizes weakness-review candidates over brand-new items within a group', () => {
    const weak = item({ id: 'c-weak', subjectId: 'civil', kind: 'concept_ox' });
    const fresh = item({ id: 'c-new', subjectId: 'civil', kind: 'concept_ox' });
    const states = new Map([[weak.id, dueState(weak.id, 1, 0)]]);
    const plan = buildDailyPlan({
      learnerId: 'local',
      studyDay: '2026-09-28',
      planVersion: 1,
      generatedAtUtc: '2026-09-28T00:00:00Z',
      availableMinutes: 1, // 딱 하나만 들어갈 예산
      currentContext: 'focused',
      items: [fresh, weak],
      reviewStates: states,
    });
    const civilItems = plan.items.filter((i) => i.subjectId === 'civil');
    expect(civilItems).toHaveLength(1);
    expect(civilItems[0]?.itemId).toBe('c-weak');
    expect(civilItems[0]?.kind).toBe('weakness_review');
  });

  it('preserves previously completed items untouched across replans (12.6 stability)', () => {
    const first = buildDailyPlan({
      learnerId: 'local',
      studyDay: '2026-09-28',
      planVersion: 1,
      generatedAtUtc: '2026-09-28T00:00:00Z',
      availableMinutes: 10,
      currentContext: 'focused',
      items: [civilItem],
      reviewStates: new Map(),
    });
    const completedFirst = {
      ...first,
      items: first.items.map((i) => ({ ...i, completed: true })),
    };

    const secondItems = [civilItem, patentItem];
    const second = buildDailyPlan({
      learnerId: 'local',
      studyDay: '2026-09-28',
      planVersion: 2,
      generatedAtUtc: '2026-09-28T09:00:00Z',
      availableMinutes: 10,
      currentContext: 'focused',
      items: secondItems,
      reviewStates: new Map(),
      previousPlan: completedFirst,
    });

    const civilInSecond = second.items.find((i) => i.itemId === civilItem.id);
    expect(civilInSecond?.completed).toBe(true);
    expect(second.items.some((i) => i.itemId === patentItem.id)).toBe(true);
  });

  it('guarantees a minimum goal of short reviews when the time budget is too small (12.7)', () => {
    const weak = item({ id: 'c-weak', subjectId: 'civil', kind: 'legal_statement' }); // 1분 항목
    const states = new Map([[weak.id, dueState(weak.id, 1, 0)]]);
    const plan = buildDailyPlan({
      learnerId: 'local',
      studyDay: '2026-09-28',
      planVersion: 1,
      generatedAtUtc: '2026-09-28T00:00:00Z',
      availableMinutes: 0,
      currentContext: 'focused',
      items: [weak],
      reviewStates: states,
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.itemId).toBe('c-weak');
  });
});
