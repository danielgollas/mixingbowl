import type { Pattern } from '../data/types';

export interface ProgramPosition {
  started: boolean;
  daysUntilStart: number;
  /** 1..7 within the repeating seven-day cycle. */
  day: number;
  week: number;
  pattern: Pattern;
}

const DAY_MS = 86_400_000;

// Dates are local calendar dates ("YYYY-MM-DD"). Doing the arithmetic in UTC keeps DST out of it.
function toUtc(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export const daysBetween = (from: string, to: string): number => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

export const addDays = (date: string, days: number): string =>
  new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);

export const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

/** Brief: days 1, 3, 5, 7 are Pattern A; days 2, 4, 6 are Pattern B. */
export const patternForDay = (day: number): Pattern => (day % 2 === 1 ? 'A' : 'B');

export function programPosition(startDate: string, today: string): ProgramPosition {
  const elapsed = daysBetween(startDate, today);
  if (elapsed < 0) {
    return { started: false, daysUntilStart: -elapsed, day: 1, week: 1, pattern: 'A' };
  }
  const day = (elapsed % 7) + 1;
  return { started: true, daysUntilStart: 0, day, week: Math.floor(elapsed / 7) + 1, pattern: patternForDay(day) };
}

/** The seven dates of the current program week (week 1 if the program hasn't started). */
export function weekDates(startDate: string, today: string): string[] {
  const elapsed = Math.max(0, daysBetween(startDate, today));
  const weekStart = addDays(startDate, elapsed - (elapsed % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
