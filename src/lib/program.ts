export interface ProgramPosition {
  started: boolean;
  daysUntilStart: number;
  /** 1..7 within the program week. */
  day: number;
  week: number;
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

export function programPosition(startDate: string, today: string): ProgramPosition {
  const elapsed = daysBetween(startDate, today);
  if (elapsed < 0) return { started: false, daysUntilStart: -elapsed, day: 1, week: 1 };
  return { started: true, daysUntilStart: 0, day: (elapsed % 7) + 1, week: Math.floor(elapsed / 7) + 1 };
}

/** The first date of a program week (week 1 starts on the start date). */
export const weekStart = (startDate: string, week: number): string => addDays(startDate, (week - 1) * 7);

/** The seven dates of a program week. */
export const weekDays = (startDate: string, week: number): string[] =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart(startDate, week), i));
