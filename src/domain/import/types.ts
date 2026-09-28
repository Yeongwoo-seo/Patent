import type { DurationRule, GradingSpec, LearningItem, SourceAsset } from '../types';
import type { ContentLink, TextbookParagraph } from '../reader/types';

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
  parseErrors: ParseIssue[];
};
