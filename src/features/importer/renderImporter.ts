import type { IDBPDatabase } from 'idb';
import { el } from '../../app/dom';
import { parseContentPackage, type RawContentPackageFiles } from '../../domain/import/parseContentPackage';
import type { ParsedContentPackage } from '../../domain/import/types';
import { applyImport, runImportDryRun, type ImportDryRunReport } from '../../data/repositories/importRepository';
import type { HoedokshilDB } from '../../data/indexeddb/schema';

type TextFileRole = Exclude<keyof RawContentPackageFiles, 'assetTextByBasename'>;

const ROLE_BY_BASENAME: Record<string, TextFileRole> = {
  'manifest.json': 'manifestText',
  'learning-items.jsonl': 'learningItemsText',
  'grading-specs.jsonl': 'gradingSpecsText',
  'duration-rules.jsonl': 'durationRulesText',
  'textbook-paragraphs.jsonl': 'textbookParagraphsText',
  'content-links.jsonl': 'contentLinksText',
  'choice-options.jsonl': 'choiceOptionsText',
  'source-assets.jsonl': 'sourceAssetsText',
};

async function filesToRaw(files: FileList): Promise<RawContentPackageFiles> {
  const raw: RawContentPackageFiles = {
    manifestText: null,
    learningItemsText: null,
    gradingSpecsText: null,
    durationRulesText: null,
    textbookParagraphsText: null,
    contentLinksText: null,
    choiceOptionsText: null,
    sourceAssetsText: null,
    assetTextByBasename: {},
  };
  for (const file of Array.from(files)) {
    // webkitdirectory로 선택하면 상대경로가 섞여 들어올 수 있으므로 basename만 본다
    // (패키지 안에서 파일명이 전부 고유하다는 전제 - README_FOR_CLAUDE.md의 고정 레이아웃).
    const basename = file.name.split('/').pop() ?? file.name;
    const text = await file.text();
    const role = ROLE_BY_BASENAME[basename];
    if (role) raw[role] = text;
    else raw.assetTextByBasename[basename] = text;
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
    el('p', { className: 'muted', text: 'manifest.json과 data/*.jsonl, assets/* 파일을 한 번에 선택하세요. 학습 기록(attemptEvents/reviewStates)은 이 가져오기가 건드리지 않습니다.' }),
  );

  const input = el('input', { type: 'file', multiple: true, accept: '.json,.jsonl,.svg' });
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
