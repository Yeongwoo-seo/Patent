import { describe, expect, it } from 'vitest';
import { computeParagraphStats } from '@/domain/reader/paragraphStats';
import { newReviewState } from '@/domain/review/reduceReviewState';
import type { ReviewState } from '@/domain/types';

function state(overrides: Partial<ReviewState>): ReviewState {
  return { ...newReviewState('local', 'x', 0, 'v1'), status: 'active', ...overrides };
}

describe('computeParagraphStats (9.2)', () => {
  it('counts never-attempted linked items as unconfirmed, not as correct', () => {
    const stats = computeParagraphStats(['a', 'b'], new Map());
    expect(stats).toEqual({ linkedItemCount: 2, incorrectLinkedCount: 0, unconfirmedCount: 2 });
  });

  it('counts items with a review state still in "new" status as unconfirmed', () => {
    const states = new Map([['a', state({ status: 'new' })]]);
    const stats = computeParagraphStats(['a'], states);
    expect(stats.unconfirmedCount).toBe(1);
    expect(stats.incorrectLinkedCount).toBe(0);
  });

  it('flags an item with incorrect or unknown history as an incorrect-linked item', () => {
    const states = new Map([
      ['a', state({ incorrectCount: 1 })],
      ['b', state({ unknownCount: 1 })],
      ['c', state({ incorrectCount: 0, unknownCount: 0 })],
    ]);
    const stats = computeParagraphStats(['a', 'b', 'c'], states);
    expect(stats).toEqual({ linkedItemCount: 3, incorrectLinkedCount: 2, unconfirmedCount: 0 });
  });

  it('never fabricates a count for items outside the linked list', () => {
    const states = new Map([['unrelated', state({ incorrectCount: 5 })]]);
    const stats = computeParagraphStats(['a'], states);
    expect(stats.incorrectLinkedCount).toBe(0);
    expect(stats.unconfirmedCount).toBe(1);
  });
});
