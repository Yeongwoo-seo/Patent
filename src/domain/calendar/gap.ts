/** 두 UTC 시각 사이의 경과 시간(시간 단위)을 계산한다. */
export function hoursBetween(earlierUtc: string, laterUtc: string): number {
  const a = new Date(earlierUtc).getTime();
  const b = new Date(laterUtc).getTime();
  return (b - a) / (60 * 60 * 1000);
}

/**
 * 11.4.6 최소 간격 규칙: 직전 답 노출/유효 평가 이후 minHours 이상 지났는지 확인한다.
 * 기준 시각이 없으면(첫 시도) 간격 조건은 항상 충족된다.
 */
export function minGapSatisfied(
  previousUtc: string | null,
  currentUtc: string,
  minHours: number,
): boolean {
  if (previousUtc === null) return true;
  return hoursBetween(previousUtc, currentUtc) >= minHours;
}
