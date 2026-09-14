import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, programPosition, weekDates } from './program';

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
    ['2026-09-14', 1, 1, 'A'],
    ['2026-09-15', 2, 1, 'B'],
    ['2026-09-20', 7, 1, 'A'],
    ['2026-09-21', 1, 2, 'A'],
    ['2026-09-22', 2, 2, 'B'],
    ['2026-09-28', 1, 3, 'A'],
  ] as const)('%s is day %i of week %i (pattern %s)', (today, day, week, pattern) => {
    expect(programPosition(start, today)).toEqual({ started: true, daysUntilStart: 0, day, week, pattern });
  });

  it('previews day 1 before the start date', () => {
    expect(programPosition(start, '2026-09-11')).toEqual({
      started: false,
      daysUntilStart: 3,
      day: 1,
      week: 1,
      pattern: 'A',
    });
  });
});

describe('weekDates', () => {
  it('returns the seven dates of the current program week', () => {
    expect(weekDates('2026-09-14', '2026-09-23')).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('returns week 1 before the program starts', () => {
    expect(weekDates('2026-09-14', '2026-09-01')[0]).toBe('2026-09-14');
  });
});
