import { compareStudyDay } from '../calendar/studyDay';
import { estimateMinutesForKind } from './estimateMinutes';
import type { LearningContext, LearningItem, ReviewState, SubjectGroup } from '../types';
import { SUBJECT_GROUP_OF } from '../types';
import type { DailyPlan, QuestItem, QuestReasonCode } from './types';

export type BuildDailyPlanInput = {
  learnerId: string;
  studyDay: string;
  planVersion: number;
  generatedAtUtc: string;
  availableMinutes: number;
  currentContext: LearningContext;
  /** 사용자가 선택한 대분류 비중. 생략 시 12.4의 초기값(균등 비중)을 사용한다. */
  subjectGroupWeights?: Record<SubjectGroup, number>;
  items: LearningItem[];
  /** itemId -> ReviewState. 학습 이력이 없는 항목은 맵에 없다(=신규 진도 후보). */
  reviewStates: ReadonlyMap<string, ReviewState>;
  /** 12.6 계획 안정성: 이전 계획에서 이미 완료한 항목은 그대로 보존한다. */
  previousPlan?: DailyPlan | null;
};

const SUBJECT_GROUPS: SubjectGroup[] = ['civil_law', 'ip_law', 'science'];

function equalWeights(): Record<SubjectGroup, number> {
  return { civil_law: 1, ip_law: 1, science: 1 };
}

type Bucket = 'weakness' | 'memory' | 'new';

function classify(item: LearningItem, state: ReviewState | undefined, studyDay: string): Bucket | null {
  if (!state || state.status === 'new') return 'new';
  if (state.status === 'suspended' || state.status === 'needs_verification') return null;
  const due = state.dueStudyDay !== null && compareStudyDay(studyDay, state.dueStudyDay) >= 0;
  if (!due) return null;
  if (state.incorrectCount > 0 || state.unknownCount > 0) return 'weakness';
  return 'memory';
}

function reasonCodesFor(bucket: Bucket, state: ReviewState | undefined): QuestReasonCode[] {
  if (bucket === 'new') return [];
  if (bucket === 'weakness') {
    return state && state.unknownCount > 0 ? ['last_evidence_ambiguous'] : ['missed_yesterday'];
  }
  return ['due_review'];
}

/**
 * 12.3 선택 절차 + 12.4 시간 배분의 최소 구현.
 *
 * 알려진 단순화(문서 대비 미구현 부분 — KNOWN_LIMITATIONS.md 참조):
 * - 12.5 "연속 3회 배정 제외 시 우선순위 승격"은 이력 추적이 필요해 이번 MVP에는 없다.
 * - 자산 누락/오프라인 다운로드 상태에 따른 후보 제외(12.3-1,2 일부)는 아직 반영하지 않는다.
 * - 실제 유효 풀이시간 기반 시간 예측 보정(12.4)은 없고 고정 초기값만 사용한다.
 */
export function buildDailyPlan(input: BuildDailyPlanInput): DailyPlan {
  const weights = input.subjectGroupWeights ?? equalWeights();
  const totalWeight = SUBJECT_GROUPS.reduce((sum, g) => sum + (weights[g] ?? 0), 0) || 1;

  const previousCompleted = new Map<string, QuestItem>();
  for (const qi of input.previousPlan?.items ?? []) {
    if (qi.completed) previousCompleted.set(qi.itemId, qi);
  }

  type Candidate = { item: LearningItem; bucket: Bucket; state: ReviewState | undefined };
  const byGroup = new Map<SubjectGroup, Candidate[]>(SUBJECT_GROUPS.map((g) => [g, []]));

  for (const item of input.items) {
    if (previousCompleted.has(item.id)) continue; // 완료 항목은 그대로 보존, 재평가 후보에서 제외
    if (!item.availableContexts.includes(input.currentContext)) continue;
    // 12.3-2: 검증 대기·미검증·분쟁 상태의 항목은 자동 채점 퀘스트 후보에서 제외한다.
    // (원문 열람/수동 학습은 '학습' 탭에서 계속 가능하며, 여기서 배제되는 것은 자동 퀘스트뿐이다.)
    if (item.verification !== 'verified') continue;
    const state = input.reviewStates.get(item.id);
    const bucket = classify(item, state, input.studyDay);
    if (bucket === null) continue;
    byGroup.get(SUBJECT_GROUP_OF[item.subjectId])!.push({ item, bucket, state });
  }

  // 후보가 없는 과목의 예산은 다른 과목으로 재배분한다(12.4).
  const groupsWithCandidates = SUBJECT_GROUPS.filter((g) => (byGroup.get(g)?.length ?? 0) > 0);
  const reallocationNote: string[] = [];
  const activeWeightTotal =
    groupsWithCandidates.length > 0
      ? groupsWithCandidates.reduce((sum, g) => sum + (weights[g] ?? 0), 0) || 1
      : totalWeight;
  for (const g of SUBJECT_GROUPS) {
    if (!groupsWithCandidates.includes(g) && (byGroup.get(g)?.length ?? 0) === 0) {
      reallocationNote.push(`${g} 과목 후보 없음 — 예산을 다른 대분류로 재배분`);
    }
  }

  const groupBudget: Record<SubjectGroup, number> = { civil_law: 0, ip_law: 0, science: 0 };
  for (const g of groupsWithCandidates) {
    groupBudget[g] = Math.round((input.availableMinutes * (weights[g] ?? 0)) / activeWeightTotal);
  }

  const items: QuestItem[] = [...previousCompleted.values()];
  let excludedCount = 0;
  const excludedReasons: string[] = [...reallocationNote];

  const bucketOrder: Bucket[] = ['weakness', 'memory', 'new'];
  for (const g of groupsWithCandidates) {
    let remaining = groupBudget[g];
    const candidates = byGroup.get(g)!;
    for (const bucket of bucketOrder) {
      const inBucket = candidates.filter((c) => c.bucket === bucket);
      for (const c of inBucket) {
        const minutes = estimateMinutesForKind(c.item.kind);
        if (minutes <= remaining) {
          items.push({
            itemId: c.item.id,
            subjectId: c.item.subjectId,
            kind: bucket === 'new' ? 'new_progress' : bucket === 'weakness' ? 'weakness_review' : 'memory_maintenance',
            reasonCodes: reasonCodesFor(bucket, c.state),
            estimatedMinutes: minutes,
            completed: false,
          });
          remaining -= minutes;
        } else {
          excludedCount += 1;
        }
      }
    }
  }

  if (excludedCount > 0) {
    excludedReasons.push(`오늘 시간 예산 초과로 ${excludedCount}개 항목을 다음 기회로 미룸`);
  }

  // 12.7 최소 목표: 예산이 너무 작아 아무것도 배정되지 않았다면, 짧은 복습을 최대 5개까지는
  // 과목별 예산과 무관하게 보장한다("최소 목표 완료" 상태를 만들 수 있게 함).
  const newlyAssigned = items.length - previousCompleted.size;
  if (newlyAssigned === 0) {
    const shortCandidates = SUBJECT_GROUPS.flatMap((g) => byGroup.get(g) ?? [])
      .filter((c) => c.bucket !== 'new')
      .sort((a, b) => estimateMinutesForKind(a.item.kind) - estimateMinutesForKind(b.item.kind))
      .slice(0, 5);
    for (const c of shortCandidates) {
      items.push({
        itemId: c.item.id,
        subjectId: c.item.subjectId,
        kind: c.bucket === 'weakness' ? 'weakness_review' : 'memory_maintenance',
        reasonCodes: reasonCodesFor(c.bucket, c.state),
        estimatedMinutes: estimateMinutesForKind(c.item.kind),
        completed: false,
      });
    }
    if (shortCandidates.length > 0) {
      excludedReasons.push('시간 예산이 매우 적어 최소 목표(짧은 복습 최대 5개)만 배정함');
    }
  }

  return {
    learnerId: input.learnerId,
    studyDay: input.studyDay,
    planVersion: input.planVersion,
    generatedAtUtc: input.generatedAtUtc,
    availableMinutes: input.availableMinutes,
    currentContext: input.currentContext,
    subjectGroupBudgetMinutes: groupBudget,
    items,
    excludedCount,
    excludedReasons,
  };
}
