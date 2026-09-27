import { describe, expect, it } from 'vitest';
import { addStudyDays, compareStudyDay, computeStudyDay, studyDayHasArrived } from '@/domain/calendar/studyDay';

describe('computeStudyDay', () => {
  it('applies the Sydney timezone and 00:00 day boundary by default', () => {
    // 2026-09-28T13:00:00Z is 2026-09-28 23:00 in Australia/Sydney (UTC+10 in Sep, before DST switch in Oct 2026... verify with 09:59 local)
    expect(computeStudyDay('2026-09-28T13:00:00.000Z', 'Australia/Sydney', 0)).toBe('2026-09-28');
  });

  it('rolls over to the next calendar day past midnight local time', () => {
    // 14:30 UTC on Sep 28 = 00:30 local Sep 29 in Sydney (UTC+10 before DST)
    expect(computeStudyDay('2026-09-28T14:30:00.000Z', 'Australia/Sydney', 0)).toBe('2026-09-29');
  });

  it('shifts the boundary when dayBoundaryMinutes is non-zero', () => {
    // 00:30 local (see above) with a 05:00 boundary should still count as the previous studyDay.
    expect(computeStudyDay('2026-09-28T14:30:00.000Z', 'Australia/Sydney', 300)).toBe('2026-09-28');
  });

  it('does not use raw 24h-ms arithmetic across a DST transition', () => {
    // Sydney DST starts 2026-10-04 (spring forward). Two instants exactly 24h apart in UTC
    // can land on different local calendar days once the offset changes; computeStudyDay must
    // still key off the local wall-clock date, not fixed millisecond arithmetic.
    const before = computeStudyDay('2026-10-03T13:30:00.000Z', 'Australia/Sydney', 0);
    const after = computeStudyDay('2026-10-04T13:30:00.000Z', 'Australia/Sydney', 0);
    expect(before).toBe('2026-10-03');
    expect(after).toBe('2026-10-05');
  });
});

describe('addStudyDays', () => {
  it('adds calendar days across month boundaries', () => {
    expect(addStudyDays('2026-09-28', 1)).toBe('2026-09-29');
    expect(addStudyDays('2026-09-29', 3)).toBe('2026-10-02');
    expect(addStudyDays('2026-10-02', 7)).toBe('2026-10-09');
  });

  it('adds calendar days across a DST transition without drifting', () => {
    expect(addStudyDays('2026-10-03', 1)).toBe('2026-10-04');
  });

  it('supports negative offsets', () => {
    expect(addStudyDays('2026-10-01', -1)).toBe('2026-09-30');
  });
});

describe('compareStudyDay / studyDayHasArrived', () => {
  it('compares ISO date-keyed strings lexicographically', () => {
    expect(compareStudyDay('2026-09-28', '2026-09-29')).toBeLessThan(0);
    expect(compareStudyDay('2026-09-29', '2026-09-28')).toBeGreaterThan(0);
    expect(compareStudyDay('2026-09-28', '2026-09-28')).toBe(0);
  });

  it('treats a null due date as always arrived', () => {
    expect(studyDayHasArrived('2026-09-28', null)).toBe(true);
  });

  it('requires the current studyDay to be on or after the due date', () => {
    expect(studyDayHasArrived('2026-09-28', '2026-09-29')).toBe(false);
    expect(studyDayHasArrived('2026-09-29', '2026-09-29')).toBe(true);
    expect(studyDayHasArrived('2026-09-30', '2026-09-29')).toBe(true);
  });
});
