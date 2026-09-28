import type { IDBPDatabase } from 'idb';
import { loadSettings, saveSettings, type AppSettings } from '../../app/settings';
import type { HoedokshilDB } from '../../data/indexeddb/schema';
import { DB_NAME } from '../../data/indexeddb/schema';
import { closeDb } from '../../data/indexeddb/db';
import { el } from '../../app/dom';
import { renderImporter } from '../importer/renderImporter';

const TIMEZONES = ['Australia/Sydney', 'Asia/Seoul', 'UTC'];

export function renderSettings(main: HTMLElement, db: IDBPDatabase<HoedokshilDB>, onChanged: () => void): void {
  main.replaceChildren();
  main.append(Object.assign(document.createElement('h1'), { textContent: '설정' }));
  const settings = loadSettings();

  main.append(Object.assign(document.createElement('h2'), { textContent: '시간대 · 하루 경계 (11.3)' }));
  const tzSelect = document.createElement('select');
  for (const tz of TIMEZONES) {
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz;
    opt.selected = tz === settings.timeZone;
    tzSelect.append(opt);
  }
  tzSelect.onchange = () => persist({ ...settings, timeZone: tzSelect.value });

  const boundaryInput = document.createElement('input');
  boundaryInput.type = 'number';
  boundaryInput.min = '0';
  boundaryInput.max = '1439';
  boundaryInput.value = String(settings.dayBoundaryMinutes);
  boundaryInput.onchange = () => persist({ ...settings, dayBoundaryMinutes: Number(boundaryInput.value) || 0 });

  main.append(
    Object.assign(document.createElement('div'), { className: 'card' }, ),
  );
  const tzCard = main.lastChild as HTMLElement;
  tzCard.append(
    Object.assign(document.createElement('div'), { className: 'muted', textContent: '시간대' }),
    tzSelect,
    el('div', { className: 'muted', style: 'margin-top:10px;', text: '하루 경계(자정 이후 분, 0=00:00)' }),
    boundaryInput,
    Object.assign(document.createElement('p'), {
      className: 'reason',
      textContent: '시간대를 바꿔도 과거 이벤트는 소급 재분류되지 않습니다(11.3).',
    }),
  );

  main.append(Object.assign(document.createElement('h2'), { textContent: '대분류 시간 배분 (12.4)' }));
  const weightCard = document.createElement('div');
  weightCard.className = 'card';
  const groups = [
    { id: 'civil_law' as const, label: '민법' },
    { id: 'ip_law' as const, label: '산업재산권법' },
    { id: 'science' as const, label: '자연과학' },
  ];
  for (const g of groups) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
    const label = document.createElement('span');
    label.textContent = g.label;
    label.style.flex = '1';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = String(settings.subjectGroupWeights[g.id]);
    input.style.width = '64px';
    input.onchange = () =>
      persist({ ...settings, subjectGroupWeights: { ...settings.subjectGroupWeights, [g.id]: Number(input.value) || 0 } });
    row.append(label, input);
    weightCard.append(row);
  }
  weightCard.append(
    Object.assign(document.createElement('p'), {
      className: 'reason',
      textContent: '초기값은 균등 비중이며 시험 배점이나 최적 비율을 의미하지 않습니다(12.4).',
    }),
  );
  main.append(weightCard);

  main.append(Object.assign(document.createElement('h2'), { textContent: '알림 · 동기화' }));
  main.append(
    Object.assign(document.createElement('div'), { className: 'card' }, [
      Object.assign(document.createElement('p'), {
        textContent: '서버 동기화 및 복습 알림은 이번 세션에서 설정 대기 상태입니다. Supabase 프로젝트/VAPID 키가 준비되면 DEPLOYMENT.md의 절차를 따르세요.',
      }),
      Object.assign(document.createElement('span'), { className: 'pill', textContent: '설정 대기' }),
    ]),
  );

  renderImporter(main, db);

  main.append(Object.assign(document.createElement('h2'), { textContent: '데이터' }));
  const dangerCard = document.createElement('div');
  dangerCard.className = 'card';
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn';
  resetBtn.style.borderColor = 'var(--danger)';
  resetBtn.style.color = 'var(--danger)';
  resetBtn.textContent = '로컬 데이터 초기화 (되돌릴 수 없음)';
  resetBtn.onclick = async () => {
    if (!confirm('기기에 저장된 모든 학습 이력을 삭제합니다. 계속할까요?')) return;
    await closeDb();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    location.reload();
  };
  dangerCard.append(resetBtn);
  main.append(dangerCard);

  function persist(next: AppSettings) {
    saveSettings(next);
    onChanged();
  }
}
