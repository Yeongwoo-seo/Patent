import type { IDBPDatabase } from 'idb';
import { el } from '../../app/dom';
import { LOCAL_LEARNER_ID } from '../../app/session';
import {
  getAllLearningItems,
  getAllReviewStatesForLearner,
  getLinkedItemIdsForParagraph,
  getTextbookParagraph,
} from '../../data/repositories/contentRepository';
import { getAnnotationsForParagraph, toggleHighlight } from '../../data/repositories/annotationRepository';
import { computeParagraphStats } from '../../domain/reader/paragraphStats';
import { renderAssetImage } from '../asset/renderAssetImage';
import type { HoedokshilDB } from '../../data/indexeddb/schema';

const ROLE_LABEL: Record<string, string> = {
  principle: '원칙',
  exception: '예외',
  requirement: '요건',
  effect: '효과',
  example: '사례',
  formula: '공식',
  figure: '그림',
  narrative: '설명',
  definition: '정의',
  derivation_step: '풀이 단계',
};

export type ParagraphViewDeps = {
  db: IDBPDatabase<HoedokshilDB>;
  onBack: () => void;
  onOpenItem: (itemId: string) => void;
};

/**
 * 9장 리더 최소 구현.
 * 9.2: "문단에는 실제 연결된 기출 연도, 내가 틀린 항목 수, 미확인 항목 수를 표시한다.
 * '이 문단을 읽음'과 '연결 문제를 독립적으로 맞힘'은 다른 통계다." — 이번 세션에는 실제
 * 기출 연도 메타데이터가 없어 그 배지는 만들지 않는다(근거 없는 배지를 만들지 않는다, 4.1).
 */
export async function renderParagraphView(main: HTMLElement, paragraphId: string, deps: ParagraphViewDeps): Promise<void> {
  main.replaceChildren();
  const paragraph = await getTextbookParagraph(paragraphId, deps.db);
  if (!paragraph) {
    main.append(el('p', { className: 'muted', text: '문단을 찾을 수 없습니다.' }));
    main.append(el('button', { className: 'btn', text: '← 뒤로', onclick: deps.onBack }));
    return;
  }

  const [linkedItemIds, allItems, reviewStates, annotations] = await Promise.all([
    getLinkedItemIdsForParagraph(paragraph.id, deps.db),
    getAllLearningItems(deps.db),
    getAllReviewStatesForLearner(LOCAL_LEARNER_ID, deps.db),
    getAnnotationsForParagraph(paragraph.id, LOCAL_LEARNER_ID, deps.db),
  ]);
  const reviewMap = new Map(reviewStates.map((s) => [s.itemId, s]));
  const stats = computeParagraphStats(linkedItemIds, reviewMap);
  const isHighlighted = annotations.some((a) => a.kind === 'highlight');

  const back = el('button', { className: 'btn', text: '← 뒤로', onclick: deps.onBack });
  main.append(back);

  const header = el('div', { className: 'card' }, [
    paragraph.isSynthetic ? el('span', { className: 'pill pill-synthetic', text: '테스트용 가상 자료' }) : '',
    el('span', { className: 'pill', text: ROLE_LABEL[paragraph.role] ?? paragraph.role }),
    el('div', { style: 'font-weight:600;margin-top:6px;', text: `${paragraph.chapter} · ${paragraph.section}` }),
  ]);
  main.append(header);

  const highlightBtn = el('button', {
    className: 'btn' + (isHighlighted ? ' btn-primary' : ''),
    text: isHighlighted ? '형광펜 해제' : '형광펜 표시',
  });
  highlightBtn.onclick = async () => {
    await toggleHighlight(LOCAL_LEARNER_ID, paragraph.id, () => new Date(), deps.db);
    void renderParagraphView(main, paragraphId, deps);
  };
  main.append(el('div', { className: 'btn-row' }, [highlightBtn]));

  main.append(
    el(
      'div',
      { className: 'card' + (isHighlighted ? '' : ''), style: isHighlighted ? 'background:#fef9c3;border-color:#facc15;' : '' },
      [el('p', { text: paragraph.text })],
    ),
  );

  if (paragraph.assetIds.length > 0) {
    const imageCard = el('div', { className: 'card' });
    main.append(imageCard);
    void renderAssetImage(imageCard, paragraph.assetIds[0]!, deps.db, '원문 페이지 이미지');
  }

  main.append(el('h2', { text: '연결된 학습 항목' }));
  main.append(
    el('p', { className: 'reason', text: `연결 ${stats.linkedItemCount}개 · 오답 이력 ${stats.incorrectLinkedCount}개 · 미확인 ${stats.unconfirmedCount}개` }),
  );

  if (linkedItemIds.length === 0) {
    main.append(el('p', { className: 'muted', text: '이 문단에 연결된 학습 항목이 없습니다.' }));
  }
  for (const itemId of linkedItemIds) {
    const item = allItems.find((i) => i.id === itemId);
    if (!item) continue;
    const row = el(
      'div',
      { className: 'card', style: 'cursor:pointer;' },
      [el('div', { text: item.prompt.slice(0, 60) + (item.prompt.length > 60 ? '…' : '') })],
    );
    row.onclick = () => deps.onOpenItem(item.id);
    main.append(row);
  }
}
