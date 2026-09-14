import { SLOTS, type Slot } from '../data/types';
import { isIsoDate } from './program';
import type { WeightUnit } from './topups';

export const STORAGE_KEY = 'mixingbowl:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Settings {
  startDate: string;
  targetWeight: number | null;
  unit: WeightUnit;
}

export interface AppData {
  version: 1;
  settings: Settings;
  /** Eaten slots keyed by local date "YYYY-MM-DD". */
  eaten: Record<string, Slot[]>;
  /** Checked shopping item ids. */
  shopping: Record<string, true>;
}

export const defaultData = (today: string): AppData => ({
  version: 1,
  settings: { startDate: today, targetWeight: null, unit: 'lb' },
  eaten: {},
  shopping: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseSettings(value: unknown, today: string): Settings {
  const s = isRecord(value) ? value : {};
  return {
    startDate: typeof s.startDate === 'string' && isIsoDate(s.startDate) ? s.startDate : today,
    targetWeight:
      typeof s.targetWeight === 'number' && Number.isFinite(s.targetWeight) && s.targetWeight > 0
        ? s.targetWeight
        : null,
    unit: s.unit === 'kg' ? 'kg' : 'lb',
  };
}

function parseEaten(value: unknown): AppData['eaten'] {
  if (!isRecord(value)) return {};
  const eaten: AppData['eaten'] = {};
  for (const [date, slots] of Object.entries(value)) {
    if (!isIsoDate(date) || !Array.isArray(slots)) continue;
    const valid = SLOTS.filter((slot) => slots.includes(slot));
    if (valid.length > 0) eaten[date] = valid;
  }
  return eaten;
}

function parseShopping(value: unknown): AppData['shopping'] {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, checked]) => checked === true)) as AppData['shopping'];
}

/** Reads saved data, falling back to defaults for anything missing or invalid. Never throws. */
export function load(storage: StorageLike | null, today: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return defaultData(today);
  }
  if (!isRecord(raw) || raw.version !== 1) return defaultData(today);
  return {
    version: 1,
    settings: parseSettings(raw.settings, today),
    eaten: parseEaten(raw.eaten),
    shopping: parseShopping(raw.shopping),
  };
}

/** Returns false when there is no storage or the write fails (e.g. quota, private mode). */
export function save(storage: StorageLike | null, data: AppData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The browser's localStorage if it is usable, otherwise null. */
export function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
