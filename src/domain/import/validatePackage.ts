import type { ParsedContentPackage } from './types';

export type ValidationIssue = {
  check:
    | 'duplicate_id'
    | 'broken_reference'
    | 'missing_asset'
    | 'missing_choice_options'
    | 'invalid_correct_option'
    | 'asset_content_missing';
  file: string;
  id?: string;
  message: string;
};

function findDuplicates<T>(records: T[], idOf: (r: T) => string, file: string): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const r of records) {
    const id = idOf(r);
    if (seen.has(id)) issues.push({ check: 'duplicate_id', file, id, message: `중복된 id: ${id}` });
    seen.add(id);
  }
  return issues;
}

/**
 * 4번 요구사항: 중복 ID, 잘못된 참조, 누락 자산을 코드로 검사한다.
 * content-package/tools/validate-package.mjs와 검사 항목은 같지만, 이쪽은 파일시스템이
 * 아니라 이미 메모리에 파싱된 배열을 대상으로 하고(브라우저 런타임에서 그대로 재사용),
 * "기존 DB에 이미 있던 콘텐츠"까지 고려하지 않는다 — 그건 diffContentPackage의 몫이다.
 */
export function validatePackage(pkg: ParsedContentPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...findDuplicates(pkg.learningItems, (i) => i.id, 'learning-items.jsonl'));
  issues.push(...findDuplicates(pkg.gradingSpecs, (s) => s.id, 'grading-specs.jsonl'));
  issues.push(...findDuplicates(pkg.durationRules, (d) => d.id, 'duration-rules.jsonl'));
  issues.push(...findDuplicates(pkg.textbookParagraphs, (p) => p.id, 'textbook-paragraphs.jsonl'));
  issues.push(...findDuplicates(pkg.contentLinks, (l) => l.id, 'content-links.jsonl'));
  issues.push(...findDuplicates(pkg.sourceAssets, (a) => a.id, 'source-assets.jsonl'));
  issues.push(...findDuplicates(pkg.choiceOptions, (c) => c.itemId, 'choice-options.jsonl'));
  issues.push(...findDuplicates(pkg.examQuestions, (q) => q.id, 'exam-questions.jsonl'));
  issues.push(...findDuplicates(pkg.analysisUnits, (a) => a.id, 'analysis-units.jsonl'));
  issues.push(...findDuplicates(pkg.evidenceLinks, (l) => l.id, 'evidence-links.jsonl'));
  issues.push(...findDuplicates(pkg.explanationSegments, (s) => s.id, 'explanation-segments.jsonl'));
  issues.push(...findDuplicates(pkg.formulas, (f) => f.id, 'formulas.jsonl'));
  issues.push(...findDuplicates(pkg.hints, (h) => h.id, 'hints.jsonl'));
  issues.push(...findDuplicates(pkg.reviewQuestions, (r) => r.id, 'review-questions.jsonl'));

  const itemIds = new Set(pkg.learningItems.map((i) => i.id));
  const paragraphIds = new Set(pkg.textbookParagraphs.map((p) => p.id));
  const itemOrParagraphIds = new Set([...itemIds, ...paragraphIds]);
  const gradingSpecIds = new Set(pkg.gradingSpecs.map((s) => s.id));
  const assetIds = new Set(pkg.sourceAssets.map((a) => a.id));

  for (const item of pkg.learningItems) {
    if (item.gradingSpecId !== null && !gradingSpecIds.has(item.gradingSpecId)) {
      issues.push({ check: 'broken_reference', file: 'learning-items.jsonl', id: item.id, message: `gradingSpecId '${item.gradingSpecId}' 를 찾을 수 없음` });
    }
    for (const relId of item.relatedItemIds) {
      if (!itemIds.has(relId)) {
        issues.push({ check: 'broken_reference', file: 'learning-items.jsonl', id: item.id, message: `relatedItemIds '${relId}' 를 찾을 수 없음` });
      }
    }
    for (const assetId of item.requiredAssetIds) {
      if (!assetIds.has(assetId)) {
        issues.push({ check: 'missing_asset', file: 'learning-items.jsonl', id: item.id, message: `requiredAssetIds '${assetId}' 가 source-assets.jsonl에 없음` });
      }
    }
  }

  for (const paragraph of pkg.textbookParagraphs) {
    for (const assetId of paragraph.assetIds) {
      if (!assetIds.has(assetId)) {
        issues.push({ check: 'missing_asset', file: 'textbook-paragraphs.jsonl', id: paragraph.id, message: `assetIds '${assetId}' 가 source-assets.jsonl에 없음` });
      }
    }
  }

  for (const link of pkg.contentLinks) {
    if (!itemOrParagraphIds.has(link.fromId)) {
      issues.push({ check: 'broken_reference', file: 'content-links.jsonl', id: link.id, message: `fromId '${link.fromId}' 를 찾을 수 없음` });
    }
    if (!itemOrParagraphIds.has(link.toId)) {
      issues.push({ check: 'broken_reference', file: 'content-links.jsonl', id: link.id, message: `toId '${link.toId}' 를 찾을 수 없음` });
    }
  }

  for (const asset of pkg.sourceAssets) {
    if (asset.textContent === null && asset.binaryContent === null) {
      issues.push({ check: 'asset_content_missing', file: asset.path, id: asset.id, message: '자산 내용이 업로드되지 않음' });
    }
  }

  const choiceOptionsByItem = new Map(pkg.choiceOptions.map((co) => [co.itemId, new Set(co.options.map((o) => o.id))]));
  for (const item of pkg.learningItems) {
    const spec = pkg.gradingSpecs.find((s) => s.id === item.gradingSpecId);
    if (spec?.kind === 'choice') {
      const optionIds = choiceOptionsByItem.get(item.id);
      if (!optionIds) {
        issues.push({ check: 'missing_choice_options', file: 'choice-options.jsonl', id: item.id, message: '선택형 문항인데 선택지가 없음' });
      } else {
        for (const correctId of spec.correctOptionIds ?? []) {
          if (!optionIds.has(correctId)) {
            issues.push({ check: 'invalid_correct_option', file: 'grading-specs.jsonl', id: spec.id, message: `correctOptionIds '${correctId}' 가 선택지 목록에 없음` });
          }
        }
      }
    }
  }

  // 실제 기출 확장 계층(src/domain/exam/types.ts)의 참조 무결성.
  const questionIds = new Set(pkg.examQuestions.map((q) => q.id));
  const analysisUnitIds = new Set(pkg.analysisUnits.map((a) => a.id));

  for (const q of pkg.examQuestions) {
    if (q.questionAssetId !== null && !assetIds.has(q.questionAssetId)) {
      issues.push({ check: 'missing_asset', file: 'exam-questions.jsonl', id: q.id, message: `questionAssetId '${q.questionAssetId}' 가 source-assets.jsonl에 없음` });
    }
  }
  for (const a of pkg.analysisUnits) {
    if (!questionIds.has(a.questionId)) {
      issues.push({ check: 'broken_reference', file: 'analysis-units.jsonl', id: a.id, message: `questionId '${a.questionId}' 를 찾을 수 없음` });
    }
    for (const linkId of a.evidenceLinkIds) {
      if (!pkg.evidenceLinks.some((l) => l.id === linkId)) {
        issues.push({ check: 'broken_reference', file: 'analysis-units.jsonl', id: a.id, message: `evidenceLinkIds '${linkId}' 를 찾을 수 없음` });
      }
    }
  }
  for (const l of pkg.evidenceLinks) {
    if (!analysisUnitIds.has(l.analysisUnitId)) {
      issues.push({ check: 'broken_reference', file: 'evidence-links.jsonl', id: l.id, message: `analysisUnitId '${l.analysisUnitId}' 를 찾을 수 없음` });
    }
    if (!questionIds.has(l.questionId)) {
      issues.push({ check: 'broken_reference', file: 'evidence-links.jsonl', id: l.id, message: `questionId '${l.questionId}' 를 찾을 수 없음` });
    }
    if (!paragraphIds.has(l.textbookBlockId)) {
      issues.push({ check: 'broken_reference', file: 'evidence-links.jsonl', id: l.id, message: `textbookBlockId '${l.textbookBlockId}' 를 textbook-paragraphs.jsonl에서 찾을 수 없음` });
    }
  }
  for (const s of pkg.explanationSegments) {
    if (!questionIds.has(s.questionId)) {
      issues.push({ check: 'broken_reference', file: 'explanation-segments.jsonl', id: s.id, message: `questionId '${s.questionId}' 를 찾을 수 없음` });
    }
    if (s.analysisUnitId !== null && !analysisUnitIds.has(s.analysisUnitId)) {
      issues.push({ check: 'broken_reference', file: 'explanation-segments.jsonl', id: s.id, message: `analysisUnitId '${s.analysisUnitId}' 를 찾을 수 없음` });
    }
  }
  for (const f of pkg.formulas) {
    if (!paragraphIds.has(f.blockId)) {
      issues.push({ check: 'broken_reference', file: 'formulas.jsonl', id: f.id, message: `blockId '${f.blockId}' 를 textbook-paragraphs.jsonl에서 찾을 수 없음` });
    }
    for (const assetId of f.sourceAssetIds) {
      if (!assetIds.has(assetId)) {
        issues.push({ check: 'missing_asset', file: 'formulas.jsonl', id: f.id, message: `sourceAssetIds '${assetId}' 가 source-assets.jsonl에 없음` });
      }
    }
  }
  for (const h of pkg.hints) {
    if (!questionIds.has(h.questionId)) {
      issues.push({ check: 'broken_reference', file: 'hints.jsonl', id: h.id, message: `questionId '${h.questionId}' 를 찾을 수 없음` });
    }
  }
  for (const r of pkg.reviewQuestions) {
    if (!questionIds.has(r.questionId)) {
      issues.push({ check: 'broken_reference', file: 'review-questions.jsonl', id: r.id, message: `questionId '${r.questionId}' 를 찾을 수 없음` });
    }
  }

  return issues;
}
