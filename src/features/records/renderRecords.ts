import type { IDBPDatabase } from 'idb';
import { computeStudyDay } from '../../domain/calendar/studyDay';
import type { AppSettings } from '../../app/settings';
import type { HoedokshilDB } from '../../data/indexeddb/schema';
import type { PlannerBlock } from '../../domain/timeTracking/types';

/**
 * 13.2 10분 블록 화면의 최소 구현.
 * 알려진 단순화(KNOWN_LIMITATIONS.md 참조): 실제 활동/과목별 자동 기록은 아직 연결되지 않았고,
 * 이 화면은 탭으로 "실제 학습" 블록을 수동 기록하는 수준까지만 제공한다.
 */
export async function renderRecords(main: HTMLElement, db: IDBPDatabase<HoedokshilDB>, settings: AppSettings): Promise<void> {
  main.replaceChildren();
  main.append(Object.assign(document.createElement('h1'), { textContent: '기록' }));

  const studyDay = computeStudyDay(new Date().toISOString(), settings.timeZone, settings.dayBoundaryMinutes);
  main.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: `${studyDay} · 탭하여 수동으로 실제 학습 블록을 표시합니다.` }));

  const existing = await db.getAllFromIndex('plannerBlocks', 'byDate', studyDay);
  const blockByMinute = new Map(existing.map((b) => [b.startMinuteOfDay, b]));

  const grid = document.createElement('div');
  main.append(grid);

  for (let hour = 0; hour < 24; hour++) {
    const row = document.createElement('div');
    row.className = 'grid-hour-row';
    row.append(Object.assign(document.createElement('div'), { className: 'hour-label', textContent: String(hour).padStart(2, '0') }));
    for (let slot = 0; slot < 6; slot++) {
      const minuteOfDay = hour * 60 + slot * 10;
      const cell = document.createElement('button');
      cell.className = 'grid-cell' + (blockByMinute.has(minuteOfDay) ? ' actual' : '');
      cell.setAttribute('aria-label', `${hour}:${String(slot * 10).padStart(2, '0')}`);
      cell.onclick = () => void toggleCell(minuteOfDay, cell);
      row.append(cell);
    }
    grid.append(row);
  }

  async function toggleCell(minuteOfDay: number, cellEl: HTMLElement) {
    const existingBlock = blockByMinute.get(minuteOfDay);
    if (existingBlock) {
      await db.delete('plannerBlocks', existingBlock.id);
      blockByMinute.delete(minuteOfDay);
      cellEl.classList.remove('actual');
    } else {
      const block: PlannerBlock = {
        id: `${studyDay}-${minuteOfDay}`,
        date: studyDay,
        startMinuteOfDay: minuteOfDay,
        durationMinutes: 10,
        subjectId: null,
        activity: 'other',
        planOrActual: 'actual',
        autoOrManual: 'manual',
        linkedSessionId: null,
        note: null,
      };
      await db.put('plannerBlocks', block);
      blockByMinute.set(minuteOfDay, block);
      cellEl.classList.add('actual');
    }
  }
}
