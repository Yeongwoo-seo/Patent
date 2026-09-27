/**
 * 11.1 초기 정책 — 과목·항목 유형별로 나중에 바꿀 수 있는 정책 데이터.
 * 이 수치들은 앱의 초기 제품 설정값이며 최적 기억 간격을 보장하지 않는다(11.1, 11.4).
 */
export type ReviewPolicy = {
  version: string;
  /** stage(0~4)로 "이동"할 때 적용하는 간격(일). index = 이동할 stage. */
  stageIntervalDays: readonly [number, number, number, number, number];
  minAdvanceGapHours: number;
};

export const INITIAL_REVIEW_POLICY: ReviewPolicy = {
  version: '2026.09.28-initial',
  stageIntervalDays: [1, 3, 7, 14, 30],
  minAdvanceGapHours: 8,
};
