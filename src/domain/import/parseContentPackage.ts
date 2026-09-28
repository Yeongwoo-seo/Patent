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
import type { ChoiceOptionSet, ContentPackManifest, ParseIssue, ParsedContentPackage } from './types';

/**
 * UI가 사용자로부터 받은 파일들을 "역할"별로 미리 정리한 입력.
 * 실제 디렉터리 구조(webkitdirectory 등)에 의존하지 않도록, 파일 선택 단계에서
 * 이미 파일명 기준으로 역할을 매칭해 넘겨준다(source-assets.jsonl의 path 마지막
 * 구성요소=basename으로 자산 내용을 찾는다).
 */
export type RawContentPackageFiles = {
  manifestText: string | null;
  learningItemsText: string | null;
  gradingSpecsText: string | null;
  durationRulesText: string | null;
  textbookParagraphsText: string | null;
  contentLinksText: string | null;
  choiceOptionsText: string | null;
  sourceAssetsText: string | null;
  examQuestionsText: string | null;
  analysisUnitsText: string | null;
  evidenceLinksText: string | null;
  explanationSegmentsText: string | null;
  formulasText: string | null;
  hintsText: string | null;
  reviewQuestionsText: string | null;
  /**
   * 패키지 루트 기준 상대경로(예: 'assets/base/assets/pages/P/0006.webp', source-assets.jsonl의
   * path와 동일한 값) -> 텍스트 자산 내용. basename만으로 매칭하지 않는다 — 실제 기출 콘텐츠는
   * 서로 다른 과목 폴더에 같은 파일명(예: 여러 과목의 페이지 0006.webp)이 흔히 겹친다.
   */
  assetTextByPath: Record<string, string>;
  /** 패키지 루트 기준 상대경로 -> 바이너리 자산(webp/png/jpg 등 이미지). */
  assetBinaryByPath: Record<string, Blob>;
};

export function emptyRawContentPackageFiles(): RawContentPackageFiles {
  return {
    manifestText: null,
    learningItemsText: null,
    gradingSpecsText: null,
    durationRulesText: null,
    textbookParagraphsText: null,
    contentLinksText: null,
    choiceOptionsText: null,
    sourceAssetsText: null,
    examQuestionsText: null,
    analysisUnitsText: null,
    evidenceLinksText: null,
    explanationSegmentsText: null,
    formulasText: null,
    hintsText: null,
    reviewQuestionsText: null,
    assetTextByPath: {},
    assetBinaryByPath: {},
  };
}

function parseJsonl<T>(text: string | null, file: string, issues: ParseIssue[]): T[] {
  if (text === null) return [];
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const records: T[] = [];
  lines.forEach((line, idx) => {
    try {
      records.push(JSON.parse(line) as T);
    } catch (e) {
      issues.push({ file, line: idx + 1, message: e instanceof Error ? e.message : String(e) });
    }
  });
  return records;
}

/**
 * 파싱만 한다 — 참조 무결성/중복 ID 검사는 validatePackage()의 몫이다(관심사 분리,
 * 4번 요구사항의 "파싱"과 "잘못된 참조/중복 ID" 검사를 서로 다른 함수로 나눠 각각
 * 테스트하기 쉽게 한다).
 */
export function parseContentPackage(raw: RawContentPackageFiles): ParsedContentPackage {
  const parseErrors: ParseIssue[] = [];

  let manifest: ContentPackManifest | null = null;
  if (raw.manifestText !== null) {
    try {
      manifest = JSON.parse(raw.manifestText) as ContentPackManifest;
    } catch (e) {
      parseErrors.push({ file: 'manifest.json', message: e instanceof Error ? e.message : String(e) });
    }
  } else {
    parseErrors.push({ file: 'manifest.json', message: '파일이 제공되지 않음' });
  }

  const learningItems = parseJsonl<LearningItem>(raw.learningItemsText, 'learning-items.jsonl', parseErrors);
  const gradingSpecs = parseJsonl<GradingSpec>(raw.gradingSpecsText, 'grading-specs.jsonl', parseErrors);
  const durationRules = parseJsonl<DurationRule>(raw.durationRulesText, 'duration-rules.jsonl', parseErrors);
  const textbookParagraphs = parseJsonl<TextbookParagraph>(raw.textbookParagraphsText, 'textbook-paragraphs.jsonl', parseErrors);
  const contentLinks = parseJsonl<ContentLink>(raw.contentLinksText, 'content-links.jsonl', parseErrors);
  const choiceOptions = parseJsonl<ChoiceOptionSet>(raw.choiceOptionsText, 'choice-options.jsonl', parseErrors);
  const examQuestions = parseJsonl<ExamQuestion>(raw.examQuestionsText, 'exam-questions.jsonl', parseErrors);
  const analysisUnits = parseJsonl<AnalysisUnit>(raw.analysisUnitsText, 'analysis-units.jsonl', parseErrors);
  const evidenceLinks = parseJsonl<EvidenceLink>(raw.evidenceLinksText, 'evidence-links.jsonl', parseErrors);
  const explanationSegments = parseJsonl<ExplanationSegment>(raw.explanationSegmentsText, 'explanation-segments.jsonl', parseErrors);
  const formulas = parseJsonl<FormulaRecord>(raw.formulasText, 'formulas.jsonl', parseErrors);
  const hints = parseJsonl<ExamHint>(raw.hintsText, 'hints.jsonl', parseErrors);
  const reviewQuestions = parseJsonl<ExamReviewQuestion>(raw.reviewQuestionsText, 'review-questions.jsonl', parseErrors);

  const sourceAssetsRaw = parseJsonl<Omit<SourceAsset, 'textContent' | 'binaryContent'>>(
    raw.sourceAssetsText,
    'source-assets.jsonl',
    parseErrors,
  );

  const sourceAssets: SourceAsset[] = sourceAssetsRaw.map((a) => {
    const binaryContent = raw.assetBinaryByPath[a.path] ?? null;
    const textContent = binaryContent ? null : raw.assetTextByPath[a.path] ?? null;
    if (binaryContent === null && textContent === null) {
      parseErrors.push({ file: 'source-assets.jsonl', message: `자산 파일 '${a.path}' (id=${a.id}) 이 업로드된 파일 목록에 없음` });
    }
    return { ...a, textContent, binaryContent };
  });

  return {
    manifest,
    learningItems,
    gradingSpecs,
    durationRules,
    textbookParagraphs,
    contentLinks,
    choiceOptions,
    sourceAssets,
    examQuestions,
    analysisUnits,
    evidenceLinks,
    explanationSegments,
    formulas,
    hints,
    reviewQuestions,
    parseErrors,
  };
}
