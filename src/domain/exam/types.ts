import type { SubjectId } from '../types';

/**
 * 실제 기출 콘텐츠 패키지("Astra" 형식)를 앱 도메인으로 들여오기 위한 확장 모델.
 * LearningItem/GradingSpec은 그대로 복습 엔진이 쓰고(간단한 계약 유지), 이 파일의
 * 엔터티들은 "왜 이 선지가 이 판단인가"의 근거 그래프를 보여주기 위한 상세 계층이다.
 *
 * 공식 정답이 검증된 문항이 하나도 없으므로(7.2, 7.3) 이 모델의 어떤 필드도
 * 자동 채점에 쓰지 않는다 — GradingSpec.verification은 항상 'unverified'로 수입한다.
 */

export type ExamChoice = {
  id: string;
  label: string;
  textDisplay: string;
};

export type ExamAnswerClaim = {
  value: string[] | null;
  status: string;
};

/** 원문 기출문제 전체(브리핑 4.2: 질문 유형·공통 사실관계·공식 정답과 출처). */
export type ExamQuestion = {
  id: string;
  subjectId: SubjectId;
  examName: string;
  examYear: number;
  examNumber: number;
  textNative: string;
  questionAssetId: string | null;
  choices: ExamChoice[];
  officialAnswer: ExamAnswerClaim;
  providedAnswer: ExamAnswerClaim;
  aiInferredAnswer: ExamAnswerClaim;
  /** 현행법 기준 재검토 답(민법 패키지에서 처음 등장 — 4번째 답 축). 공식/제공/AI 답과 서로 대체 불가. */
  currentLawAnswer: ExamAnswerClaim;
  standaloneOxEnabled: boolean;
  isSynthetic: boolean;
};

export type AnalysisTruthStatus = 'true' | 'false' | 'unresolved_or_not_applicable';

export type EvidenceVerificationStatus =
  | 'verified_direct'
  | 'verified_rule_application'
  | 'partial'
  | 'unlinked'
  | 'not_semantically_reviewed';

export type EvidenceRole = 'core_evidence' | 'exception_or_limitation' | 'prerequisite' | 'source_example';

export type EvidenceRelation =
  | 'supports'
  | 'refutes'
  | 'context_only'
  | 'supports_conditionally'
  | 'supports_subclaim_only'
  | 'supports_visual_observation';

/** 문제 하나에서 파생된 개별 판단 단위(선지/단계). 5.1 "선지 회독"의 실제 단위. */
export type AnalysisUnit = {
  id: string;
  questionId: string;
  /** 이 판단이 겨냥하는 원문 조각(선지/지문 등)의 텍스트. 별도 Component 엔터티 없이 여기 직접 보존한다. */
  targetText: string;
  stepNumber: number | null;
  stepTitle: string | null;
  questionCore: string | null;
  reasoningAi: string | null;
  truthValueAi: boolean | null;
  truthStatus: AnalysisTruthStatus;
  reviewStatus: EvidenceVerificationStatus | 'ai_individual_reasoning' | 'not_reviewed';
  standaloneOxEligible: boolean;
  evidenceLinkIds: string[];
};

/** 판단 단위 <-> 기본서 문단(TextbookParagraph)의 근거 연결. */
export type EvidenceLink = {
  id: string;
  analysisUnitId: string;
  questionId: string;
  textbookBlockId: string;
  quoteOriginal: string;
  role: EvidenceRole;
  relationToOrigin: EvidenceRelation;
  verificationStatus: EvidenceVerificationStatus;
  reason: string | null;
  explanationSegmentId: string | null;
};

export type ExplanationOrigin = 'ai_reasoning' | 'provided_explanation' | 'recovered_textbook_body';

/** 해설 구간 — 출처(AI 추론/제공 해설/기본서 회수 본문)를 반드시 구분해 보여준다(7장, DATA_CONTRACT). */
export type ExplanationSegment = {
  id: string;
  questionId: string;
  analysisUnitId: string | null;
  origin: ExplanationOrigin;
  official: boolean;
  textOriginal: string;
};

export type FormulaRecord = {
  id: string;
  blockId: string;
  originalText: string;
  latex: string | null;
  latexStatus: 'transcribed' | 'not_transcribed';
  sourceAssetIds: string[];
};

export type ExamHint = {
  id: string;
  questionId: string;
  text: string;
  specificity: string;
};

export type ExamReviewQuestion = {
  id: string;
  questionId: string;
  text: string;
  answer: string | null;
};
