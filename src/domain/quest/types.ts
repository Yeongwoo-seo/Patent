import type { SubjectGroup, SubjectId } from '../types';

export type QuestKind =
  | 'weakness_review'
  | 'memory_maintenance'
  | 'evidence_reinforcement'
  | 'independent_resolve'
  | 'new_progress'
  | 'listening';

export type QuestReasonCode =
  | 'missed_yesterday'
  | 'last_evidence_ambiguous'
  | 'due_review'
  | 'waited_3_assignments'
  | 'new_law_version_recheck'
  | 'independent_resolve_incomplete';

export type QuestItem = {
  itemId: string;
  subjectId: SubjectId;
  kind: QuestKind;
  reasonCodes: QuestReasonCode[];
  estimatedMinutes: number;
  completed: boolean;
};

/** 12.6 learnerId + studyDay + planVersion 로 식별되는 안정적인 일일 계획 */
export type DailyPlan = {
  learnerId: string;
  studyDay: string;
  planVersion: number;
  generatedAtUtc: string;
  availableMinutes: number;
  currentContext: 'micro' | 'focused' | 'audio';
  subjectGroupBudgetMinutes: Record<SubjectGroup, number>;
  items: QuestItem[];
  /** 12.3-9: 계획에 포함하지 못한 항목 수와 이유 */
  excludedCount: number;
  excludedReasons: string[];
};
