import { describe, expect, it } from 'vitest';
import { mergeOverlappingSegments, totalActiveMs } from '@/domain/timeTracking/types';

describe('mergeOverlappingSegments / totalActiveMs (13.4)', () => {
  it('does not double-count overlapping segments (e.g. reading + listening at once)', () => {
    const segments = [
      { startUtc: '2026-09-28T00:00:00Z', endUtc: '2026-09-28T00:10:00Z' },
      { startUtc: '2026-09-28T00:05:00Z', endUtc: '2026-09-28T00:15:00Z' },
    ];
    expect(totalActiveMs(segments)).toBe(15 * 60 * 1000);
  });

  it('sums disjoint segments normally', () => {
    const segments = [
      { startUtc: '2026-09-28T00:00:00Z', endUtc: '2026-09-28T00:10:00Z' },
      { startUtc: '2026-09-28T00:20:00Z', endUtc: '2026-09-28T00:25:00Z' },
    ];
    expect(totalActiveMs(segments)).toBe(15 * 60 * 1000);
  });

  it('merges three overlapping/adjacent segments into one span', () => {
    const segments = [
      { startUtc: '2026-09-28T00:00:00Z', endUtc: '2026-09-28T00:05:00Z' },
      { startUtc: '2026-09-28T00:05:00Z', endUtc: '2026-09-28T00:08:00Z' },
      { startUtc: '2026-09-28T00:07:00Z', endUtc: '2026-09-28T00:12:00Z' },
    ];
    const merged = mergeOverlappingSegments(segments);
    expect(merged).toHaveLength(1);
    expect(totalActiveMs(segments)).toBe(12 * 60 * 1000);
  });
});
