import type { IDBPDatabase } from 'idb';
import { submitAttempt, recordExposure, type UserSettings } from '../../data/repositories/attemptRepository';
import { demoChoiceOptions } from '../../data/fixtures/demoContent';
import { getDeviceId, nextDeviceSequence, newCorrelationId, sessionId, LOCAL_LEARNER_ID } from '../../app/session';
import { getLinkedParagraphIdsForItem, getTextbookParagraph } from '../../data/repositories/contentRepository';
import {
  getAnalysisUnit,
  getExamQuestion,
  getExplanationSegmentsForQuestion,
} from '../../data/repositories/examRepository';
import { renderAssetImage } from '../asset/renderAssetImage';
import type { AnswerPayload, Assistance, Confidence, GradingSpec, LearningItem } from '../../domain/types';
import type { ExplanationOrigin } from '../../domain/exam/types';
import type { HoedokshilDB } from '../../data/indexeddb/schema';
import { el } from '../../app/dom';

const EXPLANATION_ORIGIN_LABEL: Record<ExplanationOrigin, string> = {
  ai_reasoning: 'AI 추론(미검증)',
  provided_explanation: '제공 해설(공식 아님)',
  recovered_textbook_body: '기본서에서 회수한 본문',
};

export type ItemFlowDeps = {
  db: IDBPDatabase<HoedokshilDB>;
  settings: UserSettings;
  onDone: () => void;
  /** 9.2: 문제에서 관련 문단으로 이동. 없으면 "근거 문단 보기" 버튼을 표시하지 않는다. */
  onViewParagraph?: (paragraphId: string) => void;
};

function syntheticBadge(item: LearningItem): HTMLElement | string {
  return item.isSynthetic ? el('span', { className: 'pill pill-synthetic', text: '테스트용 가상 자료' }) : '';
}

async function doSubmit(
  deps: ItemFlowDeps,
  item: LearningItem,
  spec: GradingSpec | null,
  answer: AnswerPayload,
  confidence: Confidence,
  assistance: Assistance,
  selfReported: boolean,
  mode: string,
): Promise<{ outcome: string; dueStudyDay: string | null }> {
  const { event } = await submitAttempt(
    {
      learnerId: LOCAL_LEARNER_ID,
      deviceId: getDeviceId(),
      deviceSequence: nextDeviceSequence(),
      sessionId,
      correlationId: newCorrelationId(),
      item,
      gradingSpec: spec,
      answer,
      confidenceBeforeReveal: confidence,
      assistance,
      selfReported,
      activeDurationMs: 0,
      errorTags: [],
      source: 'manual_answer',
      mode,
      now: () => new Date(),
      settings: deps.settings,
    },
    deps.db,
  );
  const state = await deps.db.get('reviewStates', [LOCAL_LEARNER_ID, item.id, item.learningEpoch]);
  return { outcome: event.outcome, dueStudyDay: state?.dueStudyDay ?? null };
}

async function renderResult(
  container: HTMLElement,
  item: LearningItem,
  deps: ItemFlowDeps,
  outcome: string,
  dueStudyDay: string | null,
) {
  const outcomeLabel: Record<string, string> = {
    correct: '정답',
    incorrect: '오답',
    unknown: '모름/미입력',
    ungraded: '채점 보류(검증 대기)',
  };
  container.append(
    el('div', { className: 'card' }, [
      el('div', { text: outcomeLabel[outcome] ?? outcome, style: 'font-weight:600;font-size:16px;' }),
      dueStudyDay
        ? el('div', { className: 'muted', text: `다음 복습 예정일: ${dueStudyDay}` })
        : el('div', { className: 'muted', text: '이 시도는 복습 일정에 반영되지 않았습니다.' }),
    ]),
  );

  // 실제 기출 확장 계층: 이 항목이 AnalysisUnit(선지별 판단)에서 온 것이면
  // 문항 이미지 + 해설(출처 구분)을 함께 보여준다(5.2 "결론→...→기본서 문단→유사 기출" 구조 중
  // 근거/해설 부분). 공식 정답이 없으므로 "정답 비교"는 참고용임을 항상 밝힌다.
  const analysisUnit = await getAnalysisUnit(item.id, deps.db);
  if (analysisUnit) {
    const question = await getExamQuestion(analysisUnit.questionId, deps.db);
    if (question?.questionAssetId) {
      const imgCard = el('div', { className: 'card' });
      container.append(imgCard);
      void renderAssetImage(imgCard, question.questionAssetId, deps.db, '문항 원문 이미지');
    }
    if (question) {
      container.append(
        el('div', { className: 'card' }, [
          el('div', { className: 'reason', text: `${question.examName} ${question.examYear} 제${question.examNumber}번 (공식 정답 미확인)` }),
          el('div', { className: 'muted', text: `제공 해설 답: ${question.providedAnswer.value?.join(', ') ?? '없음'} · AI 추정 답: ${question.aiInferredAnswer.value?.join(', ') ?? '없음'} (둘 다 공식 정답 아님)` }),
          question.currentLawAnswer.value || question.currentLawAnswer.status !== 'not_reviewed'
            ? el('div', { className: 'muted', text: `현행법 재검토 답: ${question.currentLawAnswer.value?.join(', ') ?? '미검토'}` })
            : '',
        ]),
      );
    }

    // ExplanationSegment.analysisUnitId로 직접 조회한다 - EvidenceLink 하나당 근거 문단 하나에
    // 연결된 해설(제공 해설)만 가리키므로, 그 경로로는 같은 판단 단위의 AI 해설 구간이 누락된다.
    const allSegmentsForQuestion = await getExplanationSegmentsForQuestion(analysisUnit.questionId, deps.db);
    const segments = allSegmentsForQuestion.filter((s) => s.analysisUnitId === analysisUnit.id);
    if (segments.length > 0) {
      container.append(el('h2', { text: '해설 (출처 구분)' }));
      for (const seg of segments) {
        container.append(
          el('div', { className: 'card' }, [
            el('span', { className: 'pill', text: EXPLANATION_ORIGIN_LABEL[seg.origin] }),
            el('p', { text: seg.textOriginal }),
          ]),
        );
      }
    }
  }

  if (deps.onViewParagraph) {
    const paragraphIds = await getLinkedParagraphIdsForItem(item.id, deps.db);
    if (paragraphIds.length > 0) {
      const buttons: HTMLElement[] = [];
      for (const pid of paragraphIds) {
        const paragraph = await getTextbookParagraph(pid, deps.db);
        if (!paragraph) continue;
        buttons.push(
          el('button', {
            className: 'btn',
            text: `근거 문단 보기 · ${paragraph.section}`,
            onclick: () => deps.onViewParagraph!(pid),
          }),
        );
      }
      if (buttons.length > 0) container.append(el('div', { className: 'btn-row' }, buttons));
    }
  }

  container.append(
    el('div', { className: 'sticky-actions' }, [el('button', { className: 'btn btn-primary', text: '다음', onclick: deps.onDone })]),
  );
}

/** 10.1 OX/객관식류 기본 흐름: 제시 -> O/X/모름 -> 확실/애매 -> 제출 -> 정답/해설 -> 다음 */
function renderOxFlow(container: HTMLElement, deps: ItemFlowDeps, item: LearningItem, spec: GradingSpec | null) {
  let selected: 'O' | 'X' | 'unknown' | null = null;
  let confidence: Confidence | null = null;

  const body = el('div');
  container.append(body);

  function draw() {
    body.replaceChildren(
      el('div', { className: 'card' }, [
        syntheticBadge(item),
        el('p', { text: item.prompt }),
      ]),
      el('h2', { text: '판단' }),
      el('div', { className: 'btn-row' }, [
        el('button', { className: 'btn', text: 'O', onclick: () => { selected = 'O'; draw(); } }),
        el('button', { className: 'btn', text: 'X', onclick: () => { selected = 'X'; draw(); } }),
        el('button', { className: 'btn', text: '모름', onclick: () => { selected = 'unknown'; draw(); } }),
      ]),
    );
    if (selected) {
      body.append(
        el('h2', { text: '확신도' }),
        el('div', { className: 'btn-row' }, [
          el('button', { className: 'btn', text: '확실', onclick: () => { confidence = 'sure'; draw(); } }),
          el('button', { className: 'btn', text: '애매', onclick: () => { confidence = 'unsure'; draw(); } }),
        ]),
      );
    }
    if (selected && confidence) {
      body.append(
        el('div', { className: 'sticky-actions' }, [
          el('button', {
            className: 'btn btn-primary',
            text: '제출',
            onclick: async () => {
              const answer: AnswerPayload = { kind: 'ox', value: selected! };
              const { outcome, dueStudyDay } = await doSubmit(deps, item, spec, answer, confidence!, 'none', false, 'ox_review');
              await recordExposure({ learnerId: LOCAL_LEARNER_ID, item, kind: 'answer_reveal', now: () => new Date(), settings: deps.settings }, deps.db);
              body.replaceChildren();
              void renderResult(body, item, deps, outcome, dueStudyDay);
            },
          }),
        ]),
      );
    }
  }
  draw();
}

/** 6장류 choice 문항 — 단일 선택 */
function renderChoiceFlow(container: HTMLElement, deps: ItemFlowDeps, item: LearningItem, spec: GradingSpec | null) {
  const options = demoChoiceOptions[item.id] ?? [];
  let selected: string | null = null;
  let confidence: Confidence | null = null;
  const body = el('div');
  container.append(body);

  function draw() {
    body.replaceChildren(
      el('div', { className: 'card' }, [syntheticBadge(item), el('p', { text: item.prompt })]),
      el('h2', { text: '선택' }),
      el(
        'div',
        { className: 'btn-row' },
        options.map((o) =>
          el('button', {
            className: 'btn',
            text: o.label,
            style: selected === o.id ? 'border-color:var(--accent);font-weight:600;' : '',
            onclick: () => { selected = o.id; draw(); },
          }),
        ),
      ),
    );
    if (selected) {
      body.append(
        el('h2', { text: '확신도' }),
        el('div', { className: 'btn-row' }, [
          el('button', { className: 'btn', text: '확실', onclick: () => { confidence = 'sure'; draw(); } }),
          el('button', { className: 'btn', text: '애매', onclick: () => { confidence = 'unsure'; draw(); } }),
        ]),
      );
    }
    if (selected && confidence) {
      body.append(
        el('div', { className: 'sticky-actions' }, [
          el('button', {
            className: 'btn btn-primary',
            text: '제출',
            onclick: async () => {
              const answer: AnswerPayload = { kind: 'choice', selectedOptionIds: [selected!] };
              const { outcome, dueStudyDay } = await doSubmit(deps, item, spec, answer, confidence!, 'none', false, 'choice_review');
              await recordExposure({ learnerId: LOCAL_LEARNER_ID, item, kind: 'answer_reveal', now: () => new Date(), settings: deps.settings }, deps.db);
              body.replaceChildren();
              void renderResult(body, item, deps, outcome, dueStudyDay);
            },
          }),
        ]),
      );
    }
  }
  draw();
}

/** 8.6 계산·풀이 UX: 답 입력 -> 힌트(선택) -> 정답 확인 -> 자기보고 */
function renderIndependentFlow(container: HTMLElement, deps: ItemFlowDeps, item: LearningItem, spec: GradingSpec | null) {
  let raw = '';
  let unit: string | null = spec && spec.kind === 'numeric' ? spec.expectedUnit ?? null : null;
  let hintUsed = false;
  let revealed = false;
  const body = el('div');
  container.append(body);

  function draw() {
    body.replaceChildren(
      el('div', { className: 'card' }, [syntheticBadge(item), el('p', { text: item.prompt })]),
    );
    if (!revealed) {
      const input = el('input', { type: 'text', placeholder: '답을 입력 (단위 포함 가능)', value: raw });
      input.addEventListener('input', () => { raw = (input as HTMLInputElement).value; });
      body.append(el('h2', { text: '답안 입력' }), input);
      body.append(
        el('div', { className: 'btn-row' }, [
          el('button', {
            className: 'btn',
            text: '힌트 보기',
            onclick: async () => {
              hintUsed = true;
              await recordExposure({ learnerId: LOCAL_LEARNER_ID, item, kind: 'hint', now: () => new Date(), settings: deps.settings }, deps.db);
              draw();
            },
          }),
        ]),
      );
      if (hintUsed) body.append(el('p', { className: 'muted', text: '힌트: 공식과 단위를 먼저 정리해 보세요. (힌트 사용은 독립 풀이로 인정되지 않습니다)' }));
      body.append(
        el('div', { className: 'sticky-actions' }, [
          el('button', {
            className: 'btn btn-primary',
            text: '정답 확인',
            onclick: () => {
              revealed = true;
              draw();
            },
          }),
        ]),
      );
    } else {
      body.append(el('h2', { text: '자기보고 (8.6)' }));
      body.append(
        el('div', { className: 'btn-row' }, [
          el('button', {
            className: 'btn',
            text: '혼자 풀었음',
            onclick: () => submitIndependent('independent', hintUsed ? 'hint' : 'none'),
          }),
          el('button', { className: 'btn', text: '힌트 사용', onclick: () => submitIndependent('assisted', 'hint') }),
          el('button', { className: 'btn', text: '풀이를 본 뒤 이해', onclick: () => submitIndependent('assisted', 'solution_seen') }),
          el('button', { className: 'btn', text: '아직 못 풂', onclick: () => submitIndependent('not_solved', 'solution_seen') }),
        ]),
      );
    }
  }

  async function submitIndependent(selfReportValue: 'independent' | 'assisted' | 'not_solved', assistance: Assistance) {
    const answer: AnswerPayload = { kind: 'numeric', raw, unit };
    const confidence: Confidence = selfReportValue === 'independent' ? 'sure' : 'unsure';
    const { outcome, dueStudyDay } = await doSubmit(deps, item, spec, answer, confidence, assistance, true, 'independent_solve');
    body.replaceChildren();
    void renderResult(body, item, deps, outcome, dueStudyDay);
  }

  draw();
}

function renderSequenceFlow(container: HTMLElement, deps: ItemFlowDeps, item: LearningItem, spec: GradingSpec | null) {
  const steps = spec && spec.kind === 'sequence' && spec.correctSequence ? [...spec.correctSequence] : [];
  const shuffled = [...steps].sort(() => Math.random() - 0.5);
  const picked: string[] = [];
  const body = el('div');
  container.append(body);

  function draw() {
    body.replaceChildren(
      el('div', { className: 'card' }, [syntheticBadge(item), el('p', { text: item.prompt })]),
      el('p', { className: 'muted', text: `선택한 순서: ${picked.join(' → ') || '(없음)'}` }),
      el(
        'div',
        { className: 'btn-row' },
        shuffled
          .filter((s) => !picked.includes(s))
          .map((s) => el('button', { className: 'btn', text: s, onclick: () => { picked.push(s); draw(); } })),
      ),
    );
    if (picked.length === steps.length && steps.length > 0) {
      body.append(
        el('div', { className: 'sticky-actions' }, [
          el('button', {
            className: 'btn btn-primary',
            text: '제출',
            onclick: async () => {
              const answer: AnswerPayload = { kind: 'sequence', orderedIds: picked };
              const { outcome, dueStudyDay } = await doSubmit(deps, item, spec, answer, 'sure', 'none', false, 'sequence_review');
              body.replaceChildren();
              void renderResult(body, item, deps, outcome, dueStudyDay);
            },
          }),
        ]),
      );
    }
  }
  draw();
}

export function mountItemAnswerFlow(
  container: HTMLElement,
  item: LearningItem,
  spec: GradingSpec | null,
  deps: ItemFlowDeps,
): void {
  container.replaceChildren();
  if (item.kind === 'independent_problem') {
    renderIndependentFlow(container, deps, item, spec);
  } else if (spec?.kind === 'sequence') {
    renderSequenceFlow(container, deps, item, spec);
  } else if (spec?.kind === 'choice') {
    renderChoiceFlow(container, deps, item, spec);
  } else {
    renderOxFlow(container, deps, item, spec);
  }
}
