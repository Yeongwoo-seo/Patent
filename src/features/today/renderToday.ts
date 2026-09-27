import type { IDBPDatabase } from 'idb';
import { buildDailyPlan } from '../../domain/quest/buildDailyPlan';
import { computeStudyDay } from '../../domain/calendar/studyDay';
import { getAllLearningItems, getAllReviewStatesForLearner, getGradingSpec } from '../../data/repositories/contentRepository';
import { LOCAL_LEARNER_ID } from '../../app/session';
import type { AppSettings } from '../../app/settings';
import { mountItemAnswerFlow } from '../item/itemAnswerFlow';
import type { HoedokshilDB } from '../../data/indexeddb/schema';
import type { LearningContext } from '../../domain/types';
import type { DailyPlan, QuestItem } from '../../domain/quest/types';

const KIND_LABEL: Record<QuestItem['kind'], string> = {
  weakness_review: '약점 다시 확인하기',
  memory_maintenance: '기억 유지하기',
  evidence_reinforcement: '근거 보충',
  independent_resolve: '독립 재풀이',
  new_progress: '신규 진도',
  listening: '청취',
};

const REASON_LABEL: Record<string, string> = {
  missed_yesterday: '어제 틀림',
  last_evidence_ambiguous: '지난번 근거가 애매함',
  due_review: '복습 예정일 도래',
  waited_3_assignments: '3번 배정 대기',
  new_law_version_recheck: '새 법령 버전 재확인',
  independent_resolve_incomplete: '계산 재풀이 미완료',
};

let currentContext: LearningContext = 'focused';
let availableMinutes = 20;
let planVersion = 1;
let cachedPlan: DailyPlan | null = null;

export async function renderToday(main: HTMLElement, db: IDBPDatabase<HoedokshilDB>, settings: AppSettings): Promise<void> {
  main.replaceChildren();
  const now = new Date();
  const studyDay = computeStudyDay(now.toISOString(), settings.timeZone, settings.dayBoundaryMinutes);

  main.append(document.createElement('h1'));
  (main.lastChild as HTMLElement).textContent = '오늘의 퀘스트';
  const syncStatus = document.createElement('div');
  syncStatus.className = 'muted';
  syncStatus.textContent = '기기에 저장됨 · 서버 동기화 설정 대기';
  main.append(syncStatus);

  const controls = document.createElement('div');
  controls.className = 'card';
  const timeRow = document.createElement('div');
  timeRow.className = 'btn-row';
  for (const m of [10, 20, 40]) {
    const b = document.createElement('button');
    b.className = 'btn' + (availableMinutes === m ? ' btn-primary' : '');
    b.textContent = `${m}분`;
    b.onclick = () => { availableMinutes = m; void refresh(); };
    timeRow.append(b);
  }
  const ctxRow = document.createElement('div');
  ctxRow.className = 'btn-row';
  const contexts: { id: LearningContext; label: string }[] = [
    { id: 'micro', label: '짧게 읽기·OX' },
    { id: 'focused', label: '집중 풀이' },
    { id: 'audio', label: '듣기' },
  ];
  for (const c of contexts) {
    const b = document.createElement('button');
    b.className = 'btn' + (currentContext === c.id ? ' btn-primary' : '');
    b.textContent = c.label;
    b.onclick = () => { currentContext = c.id; void refresh(); };
    ctxRow.append(b);
  }
  controls.append(
    Object.assign(document.createElement('div'), { className: 'muted', textContent: '오늘 가능 시간' }),
    timeRow,
    Object.assign(document.createElement('div'), { className: 'muted', textContent: '현재 상황' }),
    ctxRow,
  );
  main.append(controls);

  const listEl = document.createElement('div');
  main.append(listEl);

  async function refresh() {
    const items = await getAllLearningItems(db);
    const reviewStates = await getAllReviewStatesForLearner(LOCAL_LEARNER_ID, db);
    const reviewMap = new Map(reviewStates.map((s) => [s.itemId, s]));

    const plan = buildDailyPlan({
      learnerId: LOCAL_LEARNER_ID,
      studyDay,
      planVersion,
      generatedAtUtc: now.toISOString(),
      availableMinutes,
      currentContext,
      subjectGroupWeights: settings.subjectGroupWeights,
      items,
      reviewStates: reviewMap,
      previousPlan: cachedPlan,
    });
    cachedPlan = plan;

    listEl.replaceChildren();
    if (plan.items.length === 0) {
      listEl.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: '지금 상황에 배정할 항목이 없습니다.' }));
    }
    for (const qi of plan.items) {
      const row = document.createElement('div');
      row.className = 'card';
      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.textContent = `${KIND_LABEL[qi.kind]} · ${qi.subjectId}`;
      const reason = document.createElement('div');
      reason.className = 'reason';
      reason.textContent = qi.reasonCodes.map((r) => REASON_LABEL[r] ?? r).join(', ') || '신규 항목';
      const status = document.createElement('span');
      status.className = 'pill';
      status.textContent = qi.completed ? '완료' : `${qi.estimatedMinutes}분`;
      row.append(title, reason, status);
      if (!qi.completed) {
        row.style.cursor = 'pointer';
        row.onclick = () => void openItem(qi.itemId);
      }
      listEl.append(row);
    }

    const footer = document.createElement('div');
    footer.className = 'muted';
    footer.style.marginTop = '10px';
    footer.textContent =
      plan.excludedReasons.length > 0
        ? `참고: ${plan.excludedReasons.join(' / ')}`
        : '오늘 배정 외 대기 항목 없음';
    listEl.append(footer);
  }

  async function openItem(itemId: string) {
    const items = await getAllLearningItems(db);
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const spec = item.gradingSpecId ? (await getGradingSpec(item.gradingSpecId, db)) ?? null : null;
    main.replaceChildren();
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = '← 오늘로';
    back.onclick = () => void renderToday(main, db, settings);
    main.append(back);
    const flowContainer = document.createElement('div');
    main.append(flowContainer);
    mountItemAnswerFlow(flowContainer, item, spec, {
      db,
      settings: { timeZone: settings.timeZone, dayBoundaryMinutes: settings.dayBoundaryMinutes, settingsVersion: settings.settingsVersion },
      onDone: () => {
        planVersion += 1;
        void renderToday(main, db, settings);
      },
    });
  }

  await refresh();
}
