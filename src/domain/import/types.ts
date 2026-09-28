import type { DurationRule, GradingSpec, LearningItem, SourceAsset } from '../types';
import type { ContentLink, TextbookParagraph } from '../reader/types';
import type {
  AnalysisUnit,
  EvidenceLink,
  ExamHint,
  ExamQuestion,
  ExamReviewQuestion,
  ExplanationSegment,
  FormulaRecord,
} from '../exam/types';

/** content-package/schema/choice-option.schema.json과 대응 */
export type ChoiceOptionSet = {
  itemId: string;
  options: { id: string; label: string }[];
};

export type ManifestFileEntry = {
  path: string;
  sha256: string;
  byteSize: number;
  recordCount: number | null;
};

/** content-package/schema/manifest.schema.json과 대응 */
export type ContentPackManifest = {
  schemaVersion: string;
  packId: string;
  namespace: string;
  contentVersion: string;
  isSynthetic: boolean;
  subjectIds: string[];
  generatedAt: string;
  generatedBy: string;
  licenseScope: string;
  files: ManifestFileEntry[];
  legacyIdMap: Record<string, string>;
  verificationSummary: {
    verified: number;
    needsReview: number;
    unverified: number;
    disputed: number;
  };
};

export type ParseIssue = {
  file: string;
  line?: number;
  message: string;
};

export type ParsedContentPackage = {
  manifest: ContentPackManifest | null;
  learningItems: LearningItem[];
  gradingSpecs: GradingSpec[];
  durationRules: DurationRule[];
  textbookParagraphs: TextbookParagraph[];
  contentLinks: ContentLink[];
  choiceOptions: ChoiceOptionSet[];
  sourceAssets: SourceAsset[];
  /** 실제 기출 콘텐츠 확장 계층(src/domain/exam/types.ts) — 없는 패키지는 빈 배열. */
  examQuestions: ExamQuestion[];
  analysisUnits: AnalysisUnit[];
  evidenceLinks: EvidenceLink[];
  explanationSegments: ExplanationSegment[];
  formulas: FormulaRecord[];
  hints: ExamHint[];
  reviewQuestions: ExamReviewQuestion[];
  parseErrors: ParseIssue[];
};
