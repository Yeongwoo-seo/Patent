/**
 * studyDay 계산 — 11.3 "날짜와 시간" 규칙 구현.
 *
 * studyDay는 "IANA 시간대 + 하루 경계"를 적용한 달력 날짜 키(YYYY-MM-DD)다.
 * 서머타임 안전성을 위해 24*60*60*1000ms를 더하는 방식은 사용하지 않고,
 * 항상 (1) Intl로 지역 벽시계 값을 얻고 (2) UTC 기준 달력 날짜 산술만 수행한다.
 */

export interface StudyDayKey {
  readonly value: string; // YYYY-MM-DD
}

interface LocalWallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

function getLocalWallClock(instant: Date, timeZone: string): LocalWallClock {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Intl.DateTimeFormat missing part: ${type}`);
    return Number(part.value);
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateKeyFromUtcMs(utcMs: number): string {
  const d = new Date(utcMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * UTC 시각을 사용자의 시간대·하루 경계 기준 studyDay 키로 변환한다.
 * dayBoundaryMinutes: 하루가 시작하는 자정 이후 분 (기본 0 = 00:00).
 * 예) dayBoundaryMinutes=300(05:00)이면 04:59는 전날 studyDay로 계산된다.
 */
export function computeStudyDay(
  occurredAtUtc: string,
  timeZone: string,
  dayBoundaryMinutes: number,
): string {
  const instant = new Date(occurredAtUtc);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`invalid occurredAtUtc: ${occurredAtUtc}`);
  }
  const local = getLocalWallClock(instant, timeZone);
  const localMinutesOfDay = local.hour * 60 + local.minute;
  let dateUtcMs = Date.UTC(local.year, local.month - 1, local.day);
  if (localMinutesOfDay < dayBoundaryMinutes) {
    dateUtcMs -= 24 * 60 * 60 * 1000;
  }
  return formatDateKeyFromUtcMs(dateUtcMs);
}

/**
 * studyDay(YYYY-MM-DD)에 달력상의 학습일(정수, 음수 허용)을 더한다.
 * 시간대와 무관한 순수 달력 날짜 산술이므로 서머타임의 영향을 받지 않는다.
 */
export function addStudyDays(studyDay: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(studyDay);
  if (!match) throw new Error(`invalid studyDay: ${studyDay}`);
  const [, y, m, d] = match as unknown as [string, string, string, string];
  const utcMs = Date.UTC(Number(y), Number(m) - 1, Number(d)) + days * 24 * 60 * 60 * 1000;
  return formatDateKeyFromUtcMs(utcMs);
}

export function compareStudyDay(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function minStudyDay(a: string, b: string): string {
  return compareStudyDay(a, b) <= 0 ? a : b;
}

export function studyDayHasArrived(currentStudyDay: string, dueStudyDay: string | null): boolean {
  if (dueStudyDay === null) return true;
  return compareStudyDay(currentStudyDay, dueStudyDay) >= 0;
}
