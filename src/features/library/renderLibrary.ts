import type { IDBPDatabase } from 'idb';
import type { HoedokshilDB } from '../../data/indexeddb/schema';
import { el } from '../../app/dom';

const UNIT_LABEL: Record<string, string> = { day: '일', week: '주', month: '개월', year: '년' };

export async function renderLibrary(main: HTMLElement, db: IDBPDatabase<HoedokshilDB>): Promise<void> {
  main.replaceChildren();
  main.append(Object.assign(document.createElement('h1'), { textContent: '서재' }));
  main.append(
    Object.assign(document.createElement('p'), {
      className: 'muted',
      textContent:
        '이번 세션 범위: 기간 암기 카드만 우선 구현했습니다. 기본서·조문 전문 리더, 판례 원문 뷰어, 오디오 목록은 KNOWN_LIMITATIONS.md에 기재된 후속 작업입니다.',
    }),
  );

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
}
