import type { SubjectId } from '../types';

export type StudyActivity = 'reading' | 'ox' | 'mcq' | 'calculation' | 'listening' | 'other';

/**
 * 13.4 원본 학습 시간 — 초/분 단위로 보존하는 실측 구간.
 * 10분 격자는 시각적 표현일 뿐, 실제 시간의 원본은 이 엔터티다.
 */
export type TimeSegment = {
  id: string;
  learnerId: string;
  date: string; // studyDay
  startUtc: string;
  endUtc: string;
  subjectId: SubjectId | null;
  activity: StudyActivity;
  sessionId: string | null;
  measurementBasis: 'measured' | 'estimated' | 'manual';
};

/** 13.3 블록 데이터 — TimeSegment를 10분 그리드에 투영해 보여주기 위한 표현 */
export type PlannerBlock = {
  id: string;
  date: string;
  startMinuteOfDay: number; // 0..1439, 10분 단위
  durationMinutes: number; // 보통 10
  subjectId: SubjectId | null;
  activity: StudyActivity;
  planOrActual: 'plan' | 'actual';
  autoOrManual: 'auto' | 'manual';
  linkedSessionId: string | null;
  note: string | null;
};

/** 여러 세션이 겹칠 때 총 시간은 구간의 합집합으로 계산한다(13.4). */
export function mergeOverlappingSegments(
  segments: Pick<TimeSegment, 'startUtc' | 'endUtc'>[],
): { startUtc: string; endUtc: string }[] {
  if (segments.length === 0) return [];
  const sorted = [...segments]
    .map((s) => ({ start: new Date(s.startUtc).getTime(), end: new Date(s.endUtc).getTime() }))
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const seg of sorted) {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }
  return merged.map((m) => ({ startUtc: new Date(m.start).toISOString(), endUtc: new Date(m.end).toISOString() }));
}

export function totalActiveMs(segments: Pick<TimeSegment, 'startUtc' | 'endUtc'>[]): number {
  return mergeOverlappingSegments(segments).reduce(
    (sum, s) => sum + (new Date(s.endUtc).getTime() - new Date(s.startUtc).getTime()),
    0,
  );
}
