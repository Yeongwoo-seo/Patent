import type { DBSchema } from 'idb';
import type {
  AttemptEvent,
  ContentPackImportRecord,
  DurationRule,
  ExposureEvent,
  GradingSpec,
  LearningItem,
  ReviewState,
  SourceAsset,
} from '../../domain/types';
import type { DailyPlan } from '../../domain/quest/types';
import type { PlannerBlock, TimeSegment } from '../../domain/timeTracking/types';
import type { Annotation, ContentLink, TextbookParagraph } from '../../domain/reader/types';
import type { ChoiceOptionSet } from '../../domain/import/types';
import type {
  AnalysisUnit,
  EvidenceLink,
  ExamHint,
  ExamQuestion,
  ExamReviewQuestion,
  ExplanationSegment,
  FormulaRecord,
} from '../../domain/exam/types';

/** ReviewState 저장 키: learnerId+itemId+learningEpoch (11.2) */
export type ReviewStateKey = [string, string, number];

export type SyncOutboxEntry = {
  outboxId: string;
  eventId: string;
  kind: 'attempt' | 'exposure' | 'correction';
  createdAtUtc: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'sent' | 'failed';
};

export interface HoedokshilDB extends DBSchema {
  attemptEvents: {
    key: string; // eventId
    value: AttemptEvent;
    indexes: { byItem: string; byStudyDay: string; byLearner: string };
  };
  exposureEvents: {
    key: string; // eventId
    value: ExposureEvent;
    indexes: { byItem: string };
  };
  reviewStates: {
    key: ReviewStateKey;
    value: ReviewState;
    indexes: { byLearner: string; byDueStudyDay: string };
  };
  learningItems: {
    key: string; // id
    value: LearningItem;
    indexes: { bySubject: string };
  };
  gradingSpecs: {
    key: string; // id
    value: GradingSpec;
  };
  durationRules: {
    key: string; // id
    value: DurationRule;
    indexes: { bySubject: string };
  };
  syncOutbox: {
    key: string; // outboxId
    value: SyncOutboxEntry;
    indexes: { byStatus: string };
  };
  timeSegments: {
    key: string; // id
    value: TimeSegment;
    indexes: { byDate: string };
  };
  plannerBlocks: {
    key: string; // id
    value: PlannerBlock;
    indexes: { byDate: string };
  };
  dailyPlans: {
    key: [string, string, number]; // learnerId, studyDay, planVersion
    value: DailyPlan;
    indexes: { byStudyDay: string };
  };
  textbookParagraphs: {
    key: string; // id
    value: TextbookParagraph;
    indexes: { bySubject: string };
  };
  contentLinks: {
    key: string; // id
    value: ContentLink;
    indexes: { byFrom: string; byTo: string };
  };
  annotations: {
    key: string; // id
    value: Annotation;
    indexes: { byParagraph: string };
  };
  sourceAssets: {
    key: string; // id
    value: SourceAsset;
  };
  choiceOptions: {
    key: string; // itemId
    value: ChoiceOptionSet;
  };
  contentPackImports: {
    key: string; // id
    value: ContentPackImportRecord;
  };
  examQuestions: {
    key: string; // id
    value: ExamQuestion;
    indexes: { bySubject: string };
  };
  analysisUnits: {
    key: string; // id
    value: AnalysisUnit;
    indexes: { byQuestion: string };
  };
  evidenceLinks: {
    key: string; // id
    value: EvidenceLink;
    indexes: { byAnalysisUnit: string; byQuestion: string };
  };
  explanationSegments: {
    key: string; // id
    value: ExplanationSegment;
    indexes: { byQuestion: string };
  };
  formulas: {
    key: string; // id
    value: FormulaRecord;
    indexes: { byBlock: string };
  };
  hints: {
    key: string; // id
    value: ExamHint;
    indexes: { byQuestion: string };
  };
  reviewQuestions: {
    key: string; // id
    value: ExamReviewQuestion;
    indexes: { byQuestion: string };
  };
}

export const DB_NAME = 'hoedokshil';
/**
 * v1: 핵심 학습 엔진 저장소.
 * v2: 9장 리더용 저장소(textbookParagraphs/contentLinks/annotations) 추가.
 * v3: 20장 수입기용 저장소(sourceAssets/choiceOptions/contentPackImports) 추가.
 * v4: 실제 기출 콘텐츠 확장 계층(examQuestions/analysisUnits/evidenceLinks/
 *     explanationSegments/formulas/hints/reviewQuestions) 추가.
 * 21.2: 스키마 업데이트는 기존 이력을 지우지 않고 새 store만 추가하는 마이그레이션으로 처리한다.
 */
export const DB_VERSION = 4;

export function reviewStateKey(learnerId: string, itemId: string, learningEpoch: number): ReviewStateKey {
  return [learnerId, itemId, learningEpoch];
}
