/**
 * 18.1 공통 모델 원칙 — 최소 의미 계약.
 * 실제 기존 스키마가 있다면 손실 없는 매핑을 우선한다(이번 프로젝트는 신규 시작이므로 해당 없음).
 */

export type SubjectGroup = 'civil_law' | 'ip_law' | 'science';

export type SubjectId =
  | 'civil'
  | 'patent'
  | 'utility'
  | 'trademark'
  | 'design'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'earth_science';

export const SUBJECT_GROUP_OF: Record<SubjectId, SubjectGroup> = {
  civil: 'civil_law',
  patent: 'ip_law',
  utility: 'ip_law',
  trademark: 'ip_law',
  design: 'ip_law',
  physics: 'science',
  chemistry: 'science',
  biology: 'science',
  earth_science: 'science',
};

export type ItemKind =
  | 'original_mcq'
  | 'legal_statement'
  | 'statute_cloze'
  | 'case_application'
  | 'procedure'
  | 'duration'
  | 'concept_ox'
  | 'formula_recall'
  | 'formula_conditions'
  | 'diagram_interpretation'
  | 'approach_recall'
  | 'independent_problem'
  /** 실제 기출 문항에서 추출한 개별 선지/판단 단위(과목 불문). 5.1 "선지 회독"과 같은 메커니즘. */
  | 'exam_statement';

export type Verification = 'verified' | 'needs_review' | 'unverified' | 'disputed';

export type LegalValidity = {
  referenceDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  applicationConditions: string[];
  transitionalProvisionRefs: string[];
  sourceRefs: string[];
  verification: Verification;
  verifiedAt: string | null;
  verifiedBy: string | null;
};

export type LearningContext = 'micro' | 'focused' | 'audio';

export type LearningItem = {
  id: string;
  subjectId: SubjectId;
  kind: ItemKind;
  sourceContentId: string;
  contentRevisionId: string;
  learningEpoch: number;
  topicIds: string[];
  relatedItemIds: string[];
  requiredAssetIds: string[];
  availableContexts: LearningContext[];
  canStandaloneOX: boolean;
  requiresIndependentSolve: boolean;
  gradingSpecId: string | null;
  verification: Verification;
  isSynthetic: boolean;
  /** 사용자에게 보여줄 짧은 본문(선지/명제/문항 요약). 실제 원문은 Question/Option 등 별도 엔터티가 가진다. */
  prompt: string;
};

export type AnswerPayload =
  | { kind: 'ox'; value: 'O' | 'X' | 'unknown' }
  | { kind: 'choice'; selectedOptionIds: string[] }
  | { kind: 'numeric'; raw: string; unit: string | null }
  | { kind: 'cloze'; values: Record<string, string> }
  | { kind: 'sequence'; orderedIds: string[] }
  | { kind: 'self_report'; value: 'independent' | 'assisted' | 'not_solved' };

export type AttemptOutcome = 'correct' | 'incorrect' | 'unknown' | 'ungraded';
export type Confidence = 'sure' | 'unsure' | 'not_set';
export type Assistance = 'none' | 'hint' | 'solution_seen';
export type AttemptSource = 'manual_answer' | 'original_exam' | 'imported_history';

export type AttemptEvent = {
  eventId: string;
  learnerId: string;
  deviceId: string;
  deviceSequence: number;
  sessionId: string;
  correlationId: string;
  itemId: string;
  contentRevisionId: string;
  learningEpoch: number;
  gradingSpecId: string | null;
  policyVersion: string;
  occurredAtUtc: string;
  studyDay: string;
  timeZone: string;
  dayBoundaryMinutes: number;
  settingsVersion: string;
  mode: string;
  answer: AnswerPayload;
  outcome: AttemptOutcome;
  confidenceBeforeReveal: Confidence;
  assistance: Assistance;
  selfReported: boolean;
  activeDurationMs: number;
  errorTags: string[];
  source: AttemptSource;
};

export type ExposureKind = 'read' | 'listen' | 'hint' | 'answer_reveal';

export type ExposureEvent = {
  eventId: string;
  learnerId: string;
  itemId: string;
  contentRevisionId: string;
  kind: ExposureKind;
  occurredAtUtc: string;
  studyDay: string;
};

export type AttemptCorrection = {
  eventId: string;
  targetEventId: string;
  reason: string;
  createdAtUtc: string;
  newConfidence: Confidence;
};

export type ReviewStatus =
  | 'new'
  | 'active'
  | 'suspended'
  | 'needs_verification'
  | 'superseded';

export type ReviewStage = 0 | 1 | 2 | 3 | 4;

export type ReviewState = {
  learnerId: string;
  itemId: string;
  learningEpoch: number;
  stage: ReviewStage;
  dueStudyDay: string | null;
  lastAttemptEventId: string | null;
  lastAdvancedAtUtc: string | null;
  lastAdvancedStudyDay: string | null;
  lastAnswerExposureAtUtc: string | null;
  totalAttemptCount: number;
  incorrectCount: number;
  unknownCount: number;
  eligibleReviewCount: number;
  status: ReviewStatus;
  policyVersion: string;
  projectionVersion: number;
};

/** 3.3 사용자에게 보여줄 핵심 상태 (ReviewState + 콘텐츠 검증상태로부터 파생) */
export type DisplayReviewStatus =
  | 'not_started'
  | 'learning'
  | 'review_scheduled'
  | 'review_overdue'
  | 'reconfirming'
  | 'long_interval'
  | 'awaiting_verification'
  | 'suspended';

export type DurationClockType = 'relative' | 'absolute_limit' | 'multiple_clocks' | 'other';

export type WhyEvidenceType = 'legislative_material' | 'case_law' | 'literature' | 'pedagogical_inference' | 'unavailable';

export type DurationRule = {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  actor: string;
  action: string;
  durationValue: number;
  durationUnit: 'day' | 'week' | 'month' | 'year';
  startTrigger: string;
  clockType: DurationClockType;
  secondaryLimit: string | null;
  exceptions: string[];
  extensionRule: string | null;
  legalEffect: string;
  sourceRefs: string[];
  validity: LegalValidity;
  whyExplanation: string | null;
  whyEvidenceType: WhyEvidenceType;
};

/**
 * 18.2 SourceAsset — 파일 hash, 이름, 유형, 권한·비공개 여부, 원문 위치.
 * 20장 수입기(content-package/ 참고)가 다루는 자산 메타데이터.
 * 이번 세션은 텍스트 기반 자산(svg/json)만 지원한다 — 바이너리(jpg/png/mp3)는
 * textContent가 아닌 별도 저장(Blob/Cache Storage)이 필요해 미구현이다(KNOWN_LIMITATIONS).
 */
export type SourceAssetKind = 'image' | 'formula' | 'audio' | 'document';

export type SourceAsset = {
  id: string;
  kind: SourceAssetKind;
  path: string;
  mimeType: string;
  sha256: string;
  byteSize: number;
  isSynthetic: boolean;
  licenseScope: string;
  sourceLocation: string | null;
  /** 텍스트 기반 자산의 원본 내용(svg/json 등). */
  textContent: string | null;
  /** 이미지 등 바이너리 자산(webp/png/jpg). IndexedDB는 Blob을 그대로 저장할 수 있다. */
  binaryContent: Blob | null;
};

/** 18.2 ContentPack — 어떤 패키지가 언제 반영되었는지의 이력(수입기 감사 로그). */
export type ContentPackImportRecord = {
  id: string;
  packId: string;
  namespace: string;
  contentVersion: string;
  schemaVersion: string;
  importedAtUtc: string;
  counts: {
    added: number;
    updatedSameEpoch: number;
    newEpoch: number;
    unchanged: number;
    skippedConflicts: number;
  };
};

export type GradingKind = 'choice' | 'ox' | 'numeric' | 'cloze' | 'sequence' | 'self_report_only';

export type GradingSpec = {
  id: string;
  kind: GradingKind;
  correctOptionIds?: string[];
  correctOxValue?: 'O' | 'X';
  numericExpected?: number;
  numericAbsoluteTolerance?: number;
  numericRelativeTolerance?: number;
  expectedUnit?: string | null;
  correctClozeValues?: Record<string, string>;
  correctSequence?: string[];
  verification: Verification;
  contentRevisionId: string;
};
