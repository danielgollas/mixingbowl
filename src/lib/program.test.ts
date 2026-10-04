import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, programPosition, weekDays, weekStart } from './program';

describe('daysBetween', () => {
  it('counts calendar days in either direction', () => {
    expect(daysBetween('2026-09-14', '2026-09-14')).toBe(0);
    expect(daysBetween('2026-09-14', '2026-09-21')).toBe(7);
    expect(daysBetween('2026-09-14', '2026-09-10')).toBe(-4);
  });

  it('crosses month and year boundaries', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('is not shifted by DST transitions', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('addDays', () => {
  it('adds and subtracts calendar days', () => {
    expect(addDays('2026-09-14', 7)).toBe('2026-09-21');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('programPosition', () => {
  const start = '2026-09-14';

  it.each([
    ['2026-09-14', 1, 1],
    ['2026-09-15', 2, 1],
    ['2026-09-20', 7, 1],
    ['2026-09-21', 1, 2],
    ['2026-09-22', 2, 2],
    ['2026-09-28', 1, 3],
  ] as const)('%s is day %i of week %i', (today, day, week) => {
    expect(programPosition(start, today)).toEqual({ started: true, daysUntilStart: 0, day, week });
  });

  it('previews day 1 before the start date', () => {
    expect(programPosition(start, '2026-09-11')).toEqual({
      started: false,
      daysUntilStart: 3,
      day: 1,
      week: 1,
    });
  });
});

describe('program weeks', () => {
  it('starts week 1 on the start date', () => {
    expect(weekStart('2026-09-14', 1)).toBe('2026-09-14');
    expect(weekStart('2026-09-14', 3)).toBe('2026-09-28');
  });

  it('returns the seven dates of a week', () => {
    expect(weekDays('2026-09-14', 2)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });
});
