import type { IDBPDatabase } from 'idb';
import type { HoedokshilDB } from '../../data/indexeddb/schema';
import { el } from '../../app/dom';
import type { AppSettings } from '../../app/settings';
import {
  getAllLearningItems,
  getAllReviewStatesForLearner,
  getAllTextbookParagraphs,
  getGradingSpec,
  getLinkedItemIdsForParagraph,
} from '../../data/repositories/contentRepository';
import { LOCAL_LEARNER_ID } from '../../app/session';
import { computeParagraphStats } from '../../domain/reader/paragraphStats';
import { mountItemAnswerFlow } from '../item/itemAnswerFlow';
import { renderParagraphView } from '../reader/renderParagraphView';

const UNIT_LABEL: Record<string, string> = { day: '일', week: '주', month: '개월', year: '년' };

export async function renderLibrary(main: HTMLElement, db: IDBPDatabase<HoedokshilDB>, settings: AppSettings): Promise<void> {
  main.replaceChildren();
  main.append(Object.assign(document.createElement('h1'), { textContent: '서재' }));
  main.append(
    Object.assign(document.createElement('p'), {
      className: 'muted',
      textContent:
        '이번 세션 범위: 기본서 문단(일부 과목 대표 예시)과 기간 암기 카드까지 구현했습니다. 조문 전문 리더, 판례 원문 뷰어, 오디오 목록은 KNOWN_LIMITATIONS.md에 기재된 후속 작업입니다.',
    }),
  );

  main.append(Object.assign(document.createElement('h2'), { textContent: '기본서 문단 (9장)' }));
  const paragraphs = await getAllTextbookParagraphs(db);
  const reviewStates = await getAllReviewStatesForLearner(LOCAL_LEARNER_ID, db);
  const reviewMap = new Map(reviewStates.map((s) => [s.itemId, s]));
  if (paragraphs.length === 0) {
    main.append(el('p', { className: 'muted', text: '표시할 문단이 없습니다.' }));
  }
  for (const paragraph of paragraphs) {
    const linkedItemIds = await getLinkedItemIdsForParagraph(paragraph.id, db);
    const stats = computeParagraphStats(linkedItemIds, reviewMap);
    const card = el(
      'div',
      { className: 'card', style: 'cursor:pointer;' },
      [
        paragraph.isSynthetic ? el('span', { className: 'pill pill-synthetic', text: '테스트용 가상 자료' }) : '',
        el('div', { style: 'font-weight:600;margin-top:4px;', text: `${paragraph.chapter} · ${paragraph.section}` }),
        el('p', { className: 'reason', text: `연결 ${stats.linkedItemCount}개 · 오답 이력 ${stats.incorrectLinkedCount}개 · 미확인 ${stats.unconfirmedCount}개` }),
      ],
    );
    card.onclick = () => void openParagraph(paragraph.id);
    main.append(card);
  }

  main.append(Object.assign(document.createElement('h2'), { textContent: '기간 암기 카드 (6.4)' }));
  const rules = await db.getAll('durationRules');
  if (rules.length === 0) {
    main.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: '표시할 기간 카드가 없습니다.' }));
  }
  for (const rule of rules) {
    const card = document.createElement('div');
    card.className = 'card';
    const verifBadge = document.createElement('span');
    verifBadge.className = 'pill pill-synthetic';
    verifBadge.textContent = `검증 상태: ${rule.validity.verification}`;
    card.append(
      el('div', { style: 'font-weight:600;', text: `${rule.subjectId} · ${rule.actor} → ${rule.action}` }),
      Object.assign(document.createElement('div'), {
        textContent: `${rule.durationValue}${UNIT_LABEL[rule.durationUnit]} (기산점: ${rule.startTrigger})`,
      }),
      Object.assign(document.createElement('div'), { className: 'muted', textContent: `효과: ${rule.legalEffect}` }),
      verifBadge,
    );
    if (rule.whyExplanation) {
      card.append(
        Object.assign(document.createElement('div'), {
          className: 'reason',
          textContent: `학습용 설명(${rule.whyEvidenceType}): ${rule.whyExplanation}`,
        }),
      );
    }
    main.append(card);
  }

  async function openParagraph(paragraphId: string) {
    await renderParagraphView(main, paragraphId, {
      db,
      onBack: () => void renderLibrary(main, db, settings),
      onOpenItem: (itemId) => void openItem(itemId),
    });
  }

  async function openItem(itemId: string) {
    const items = await getAllLearningItems(db);
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const spec = item.gradingSpecId ? (await getGradingSpec(item.gradingSpecId, db)) ?? null : null;
    main.replaceChildren();
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = '← 서재로';
    back.onclick = () => void renderLibrary(main, db, settings);
    main.append(back);
    const flowContainer = document.createElement('div');
    main.append(flowContainer);
    mountItemAnswerFlow(flowContainer, item, spec, {
      db,
      settings: { timeZone: settings.timeZone, dayBoundaryMinutes: settings.dayBoundaryMinutes, settingsVersion: settings.settingsVersion },
      onDone: () => void renderLibrary(main, db, settings),
      onViewParagraph: (paragraphId) => void openParagraph(paragraphId),
    });
  }
}
