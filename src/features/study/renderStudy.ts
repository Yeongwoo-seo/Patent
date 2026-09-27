import type { IDBPDatabase } from 'idb';
import { getAllLearningItems, getGradingSpec } from '../../data/repositories/contentRepository';
import { mountItemAnswerFlow } from '../item/itemAnswerFlow';
import type { AppSettings } from '../../app/settings';
import type { HoedokshilDB } from '../../data/indexeddb/schema';
import { SUBJECT_GROUP_OF, type SubjectId } from '../../domain/types';
import { el } from '../../app/dom';

const SUBJECT_LABEL: Record<SubjectId, string> = {
  civil: '민법',
  patent: '특허법',
  utility: '실용신안법',
  trademark: '상표법',
  design: '디자인보호법',
  physics: '물리',
  chemistry: '화학',
  biology: '생물',
  earth_science: '지구과학',
};

const GROUP_LABEL = { civil_law: '민법', ip_law: '산업재산권법', science: '자연과학' } as const;

export async function renderStudy(main: HTMLElement, db: IDBPDatabase<HoedokshilDB>, settings: AppSettings): Promise<void> {
  main.replaceChildren();
  main.append(Object.assign(document.createElement('h1'), { textContent: '학습' }));

  const items = await getAllLearningItems(db);
  const bySubject = new Map<SubjectId, typeof items>();
  for (const item of items) {
    if (!bySubject.has(item.subjectId)) bySubject.set(item.subjectId, []);
    bySubject.get(item.subjectId)!.push(item);
  }

  for (const group of ['civil_law', 'ip_law', 'science'] as const) {
    const subjectsInGroup = (Object.keys(SUBJECT_GROUP_OF) as SubjectId[]).filter((s) => SUBJECT_GROUP_OF[s] === group);
    const hasAny = subjectsInGroup.some((s) => (bySubject.get(s)?.length ?? 0) > 0);
    if (!hasAny) continue;
    main.append(Object.assign(document.createElement('h2'), { textContent: GROUP_LABEL[group] }));
    for (const subjectId of subjectsInGroup) {
      const subjectItems = bySubject.get(subjectId) ?? [];
      if (subjectItems.length === 0) continue;
      const card = document.createElement('div');
      card.className = 'card';
      card.append(
        el('div', { style: 'font-weight:600;', text: `${SUBJECT_LABEL[subjectId]} (${subjectItems.length})` }),
      );
      for (const item of subjectItems) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:8px 0;border-top:1px solid var(--border);cursor:pointer;';
        row.textContent = item.prompt.slice(0, 40) + (item.prompt.length > 40 ? '…' : '');
        row.onclick = () => void openItem(item.id);
        card.append(row);
      }
      main.append(card);
    }
  }

  async function openItem(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const spec = item.gradingSpecId ? (await getGradingSpec(item.gradingSpecId, db)) ?? null : null;
    main.replaceChildren();
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = '← 학습 목록으로';
    back.onclick = () => void renderStudy(main, db, settings);
    main.append(back);
    const flowContainer = document.createElement('div');
    main.append(flowContainer);
    mountItemAnswerFlow(flowContainer, item, spec, {
      db,
      settings: { timeZone: settings.timeZone, dayBoundaryMinutes: settings.dayBoundaryMinutes, settingsVersion: settings.settingsVersion },
      onDone: () => void renderStudy(main, db, settings),
    });
  }
}
