import type { ReviewState } from '../types';

export type ParagraphStats = {
  linkedItemCount: number;
  incorrectLinkedCount: number;
  unconfirmedCount: number;
};

/**
 * 9.2: "문단에는 실제 연결된 기출 연도, 내가 틀린 항목 수, 미확인 항목 수를 표시한다.
 * 근거 없는 '빈출' 배지는 생성하지 않는다."
 *
 * 이 데모에는 실제 기출 연도 메타데이터가 없으므로(20.6, 합성 데이터) 연도 배지는 만들지
 * 않고, 실제로 계산 가능한 두 수치(오답/미확인)만 제공한다.
 */
export function computeParagraphStats(
  linkedItemIds: readonly string[],
  reviewStates: ReadonlyMap<string, ReviewState>,
): ParagraphStats {
  let incorrectLinkedCount = 0;
  let unconfirmedCount = 0;
  for (const itemId of linkedItemIds) {
    const state = reviewStates.get(itemId);
    if (!state || state.status === 'new') {
      unconfirmedCount += 1;
      continue;
    }
    if (state.incorrectCount > 0 || state.unknownCount > 0) {
      incorrectLinkedCount += 1;
    }
  }
  return { linkedItemCount: linkedItemIds.length, incorrectLinkedCount, unconfirmedCount };
}
