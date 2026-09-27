import type { ItemKind } from '../types';

/**
 * 12.4: "예상 시간은 초기 설정값을 사용하다가 항목 유형×과목별 실제 유효 풀이시간의 중앙값 등으로
 * 보정한다." 이 MVP는 초기 설정값(고정 상수)만 제공한다 — 실제 사용 이력 기반 보정은 미구현이며
 * KNOWN_LIMITATIONS.md에 기재한다.
 */
const DEFAULT_MINUTES_BY_KIND: Record<ItemKind, number> = {
  original_mcq: 2,
  legal_statement: 1,
  statute_cloze: 2,
  case_application: 2,
  procedure: 2,
  duration: 2,
  concept_ox: 1,
  formula_recall: 1,
  formula_conditions: 2,
  diagram_interpretation: 3,
  approach_recall: 2,
  independent_problem: 5,
};

export function estimateMinutesForKind(kind: ItemKind): number {
  return DEFAULT_MINUTES_BY_KIND[kind];
}
