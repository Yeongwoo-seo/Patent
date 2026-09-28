import type { IDBPDatabase } from 'idb';
import { el } from '../../app/dom';
import { emptyRawContentPackageFiles, parseContentPackage, type RawContentPackageFiles } from '../../domain/import/parseContentPackage';
import type { ParsedContentPackage } from '../../domain/import/types';
import { applyImport, runImportDryRun, type ImportDryRunReport } from '../../data/repositories/importRepository';
import type { HoedokshilDB } from '../../data/indexeddb/schema';

type TextFileRole = Exclude<keyof RawContentPackageFiles, 'assetTextByPath' | 'assetBinaryByPath'>;

const ROLE_BY_BASENAME: Record<string, TextFileRole> = {
  'manifest.json': 'manifestText',
  'learning-items.jsonl': 'learningItemsText',
  'grading-specs.jsonl': 'gradingSpecsText',
  'duration-rules.jsonl': 'durationRulesText',
  'textbook-paragraphs.jsonl': 'textbookParagraphsText',
  'content-links.jsonl': 'contentLinksText',
  'choice-options.jsonl': 'choiceOptionsText',
  'source-assets.jsonl': 'sourceAssetsText',
  'exam-questions.jsonl': 'examQuestionsText',
  'analysis-units.jsonl': 'analysisUnitsText',
  'evidence-links.jsonl': 'evidenceLinksText',
  'explanation-segments.jsonl': 'explanationSegmentsText',
  'formulas.jsonl': 'formulasText',
  'hints.jsonl': 'hintsText',
  'review-questions.jsonl': 'reviewQuestionsText',
};

const BINARY_ASSET_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg'];

function isBinaryAsset(filename: string): boolean {
  const lower = filename.toLowerCase();
  return BINARY_ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * 폴더 선택(webkitdirectory)이면 브라우저가 file.webkitRelativePath에
 * "선택한폴더/data/exam-questions.jsonl" 형태로 전체 경로를 채워준다. 여기서 맨 앞의
 * "선택한폴더" 세그먼트만 제거하면 패키지 루트 기준 상대경로(source-assets.jsonl의 path와
 * 동일한 값)가 된다. 개별 파일 선택(webkitdirectory 미지원 환경 포함)만 한 경우엔
 * webkitRelativePath가 비어 있으므로 file.name(=basename)으로 대체한다 — 이 경우
 * 서로 다른 과목 폴더의 동일 파일명 자산은 여전히 구분할 수 없다는 한계가 남는다.
 */
function relativePathOf(file: File): string {
  const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (webkitPath && webkitPath.includes('/')) {
    return webkitPath.slice(webkitPath.indexOf('/') + 1);
  }
  return file.name;
}

async function filesToRaw(files: FileList): Promise<RawContentPackageFiles> {
  const raw = emptyRawContentPackageFiles();
  for (const file of Array.from(files)) {
    const relativePath = relativePathOf(file);
    // manifest.json/*.jsonl은 패키지 안에서 이름이 고정·고유하므로 basename으로 찾는다.
    // 자산(이미지 등)만 전체 상대경로로 구분한다 — 과목 폴더별로 basename이 겹칠 수 있어서다.
    const basename = relativePath.split('/').pop() ?? relativePath;
    const role = ROLE_BY_BASENAME[basename];
    if (role) {
      raw[role] = await file.text();
    } else if (isBinaryAsset(basename)) {
      raw.assetBinaryByPath[relativePath] = file;
    } else {
      raw.assetTextByPath[relativePath] = await file.text();
    }
  }
  return raw;
}

const DIFF_LABEL: Record<string, string> = {
  new: '신규',
  unchanged: '변경 없음',
  updated_same_epoch: '내용 갱신(같은 학습 버전)',
  new_epoch: '새 학습 버전(재확인 필요)',
  epoch_conflict: '충돌(적용 안 함)',
  updated: '변경',
};

function countBy<T extends { kind: string }>(entries: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

function renderDiffSummary(title: string, entries: { kind: string }[]): HTMLElement {
  const counts = countBy(entries);
  const parts = Object.entries(counts)
    .map(([kind, n]) => `${DIFF_LABEL[kind] ?? kind} ${n}`)
    .join(' · ');
  return el('div', { text: `${title}: ${parts || '해당 레코드 없음'}` });
}

export function renderImporter(main: HTMLElement, db: IDBPDatabase<HoedokshilDB>): void {
  main.append(el('h2', { text: '콘텐츠 패키지 가져오기 (20장)' }));
  main.append(
    el('p', {
      className: 'muted',
      text:
        '패키지 폴더 전체(manifest.json, data/*.jsonl, assets/*)를 선택하세요. 폴더 선택을 지원하지 않는 환경이면 파일을 개별 선택할 수 있지만, 이 경우 서로 다른 과목 폴더에 같은 파일명(예: 0006.webp)의 자산이 있으면 구분되지 않습니다. 학습 기록(attemptEvents/reviewStates)은 이 가져오기가 건드리지 않습니다.',
    }),
  );

  const input = el('input', {
    type: 'file',
    multiple: true,
    webkitdirectory: true,
    accept: '.json,.jsonl,.svg,.webp,.png,.jpg,.jpeg',
  });
  const resultArea = el('div');
  main.append(el('div', { className: 'card' }, [input, resultArea]));

  let parsed: ParsedContentPackage | null = null;
  let report: ImportDryRunReport | null = null;

  input.addEventListener('change', async () => {
    if (!input.files || input.files.length === 0) return;
    resultArea.replaceChildren(el('p', { className: 'muted', text: '검사 중...' }));
    const raw = await filesToRaw(input.files);
    parsed = parseContentPackage(raw);
    report = await runImportDryRun(parsed, db);
    drawReport();
  });

  function drawReport() {
    if (!parsed || !report) return;
    resultArea.replaceChildren();

    resultArea.append(
      el('div', { style: 'font-weight:600;', text: report.manifest ? `${report.manifest.packId} @ ${report.manifest.contentVersion}` : '(manifest 없음)' }),
    );

    if (parsed.parseErrors.length > 0) {
      resultArea.append(el('h2', { text: `파싱 오류 ${parsed.parseErrors.length}건` }));
      for (const e of parsed.parseErrors.slice(0, 10)) {
        resultArea.append(el('p', { className: 'reason', text: `${e.file}${e.line ? `:${e.line}` : ''} — ${e.message}` }));
      }
    }

    if (report.validationIssues.length > 0) {
      resultArea.append(el('h2', { text: `기계 검증 오류 ${report.validationIssues.length}건` }));
      for (const issue of report.validationIssues.slice(0, 10)) {
        resultArea.append(el('p', { className: 'reason', text: `[${issue.check}] ${issue.file}${issue.id ? ` (${issue.id})` : ''} — ${issue.message}` }));
      }
    }

    resultArea.append(el('h2', { text: '변경 사항 미리보기' }));
    resultArea.append(renderDiffSummary('학습 항목', report.learningItemDiffs));
    resultArea.append(renderDiffSummary('채점 기준', report.gradingSpecDiffs));
    resultArea.append(renderDiffSummary('기간 카드', report.durationRuleDiffs));
    resultArea.append(renderDiffSummary('기본서 문단', report.textbookParagraphDiffs));
    resultArea.append(renderDiffSummary('문단 연결', report.contentLinkDiffs));
    resultArea.append(renderDiffSummary('자산', report.sourceAssetDiffs));
    resultArea.append(renderDiffSummary('선택지', report.choiceOptionDiffs));
    resultArea.append(renderDiffSummary('기출 문항', report.examQuestionDiffs));
    resultArea.append(renderDiffSummary('선지별 판단', report.analysisUnitDiffs));
    resultArea.append(renderDiffSummary('근거 연결', report.evidenceLinkDiffs));
    resultArea.append(renderDiffSummary('해설 구간', report.explanationSegmentDiffs));
    resultArea.append(renderDiffSummary('수식', report.formulaDiffs));
    resultArea.append(renderDiffSummary('힌트', report.hintDiffs));
    resultArea.append(renderDiffSummary('복습 질문', report.reviewQuestionDiffs));

    if (report.removedLearningItemIds.length > 0) {
      resultArea.append(
        el('p', { className: 'reason', text: `패키지에서 빠진 기존 항목 ${report.removedLearningItemIds.length}개 (삭제하지 않음, 검토 필요): ${report.removedLearningItemIds.join(', ')}` }),
      );
    }

    if (report.summary.epochConflicts > 0) {
      resultArea.append(
        el('p', { className: 'reason', text: `${report.summary.epochConflicts}개 항목은 기존 learningEpoch가 더 높아 적용하지 않습니다.` }),
      );
    }

    const applyBtn = el('button', {
      className: 'btn btn-primary',
      text: report.canApply ? '검토 후 적용' : '오류를 해결해야 적용 가능',
      disabled: !report.canApply,
    });
    applyBtn.onclick = async () => {
      if (!parsed || !report) return;
      applyBtn.setAttribute('disabled', 'true');
      const record = await applyImport(parsed, report, db);
      resultArea.append(
        el('div', { className: 'card', text: `적용 완료: 신규 ${record.counts.added} · 내용갱신 ${record.counts.updatedSameEpoch} · 새버전 ${record.counts.newEpoch} · 변경없음 ${record.counts.unchanged} · 건너뜀 ${record.counts.skippedConflicts}` }),
      );
    };
    resultArea.append(el('div', { className: 'sticky-actions' }, [applyBtn]));
  }
}
