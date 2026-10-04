import { DEFAULT_MEALS, SLOT_KIND, getPreset, isValidMeal } from '../data/meals';
import { SLOTS, type Meal, type MenuEntry, type Slot, type WeekMenu } from '../data/types';
import { findMeal, type CustomMeals, type Menus } from './menu';
import { isIsoDate } from './program';
import type { WeightUnit } from './targets';

/** The key still says v1 so existing data is found; the stored `version` field says how to read it. */
export const STORAGE_KEY = 'mixingbowl:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Settings {
  startDate: string;
  targetWeight: number | null;
  unit: WeightUnit;
  /** The meals you eat, in slot order. Never empty. */
  meals: Slot[];
}

export interface WeekChecks {
  prep: string[];
  shopping: string[];
}

export interface AppData {
  version: 2;
  settings: Settings;
  /** Eaten slots keyed by local date "YYYY-MM-DD". */
  eaten: Record<string, Slot[]>;
  /** Menus keyed by program week number. */
  menus: Menus;
  customMeals: CustomMeals;
  /** Checked prep component ids and shopping food ids, keyed by program week number. */
  checks: Record<string, WeekChecks>;
}

export const defaultData = (today: string): AppData => ({
  version: 2,
  settings: { startDate: today, targetWeight: null, unit: 'lb', meals: [...DEFAULT_MEALS] },
  eaten: {},
  menus: {},
  customMeals: {},
  checks: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWeekKey = (key: string) => /^[1-9]\d{0,3}$/.test(key);

const slotsIn = (value: unknown): Slot[] => (Array.isArray(value) ? SLOTS.filter((slot) => value.includes(slot)) : []);

const stringsIn = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : [];

function parseSettings(value: unknown, today: string): Settings {
  const s = isRecord(value) ? value : {};
  const meals = slotsIn(s.meals);
  return {
    startDate: typeof s.startDate === 'string' && isIsoDate(s.startDate) ? s.startDate : today,
    targetWeight:
      typeof s.targetWeight === 'number' && Number.isFinite(s.targetWeight) && s.targetWeight > 0
        ? s.targetWeight
        : null,
    unit: s.unit === 'kg' ? 'kg' : 'lb',
    meals: meals.length > 0 ? meals : [...DEFAULT_MEALS],
  };
}

function parseEaten(value: unknown): AppData['eaten'] {
  if (!isRecord(value)) return {};
  const eaten: AppData['eaten'] = {};
  for (const [date, slots] of Object.entries(value)) {
    const valid = slotsIn(slots);
    if (isIsoDate(date) && valid.length > 0) eaten[date] = valid;
  }
  return eaten;
}

function parseCustomMeals(value: unknown): CustomMeals {
  if (!isRecord(value)) return {};
  const meals: CustomMeals = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!isRecord(raw) || getPreset(id)) continue;
    const meal: Meal = { id, name: String(raw.name ?? ''), kind: 'bowl', parts: stringsIn(raw.parts) };
    if (raw.kind === 'bowl' && isValidMeal(meal)) meals[id] = meal;
  }
  return meals;
}

function parseEntries(value: unknown, slot: Slot, custom: CustomMeals): MenuEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries: MenuEntry[] = [];
  let total = 0;
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.mealId !== 'string') continue;
    const days = raw.days;
    if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || total + days > 7) continue;
    if (findMeal(raw.mealId, custom)?.kind !== SLOT_KIND[slot]) continue;
    entries.push({ mealId: raw.mealId, days });
    total += days;
  }
  return entries;
}

function parseMenus(value: unknown, custom: CustomMeals): Menus {
  if (!isRecord(value)) return {};
  const menus: Menus = {};
  for (const [week, raw] of Object.entries(value)) {
    if (!isWeekKey(week) || !isRecord(raw)) continue;
    const menu: WeekMenu = {};
    for (const slot of SLOTS) {
      const entries = parseEntries(raw[slot], slot, custom);
      if (entries) menu[slot] = entries;
    }
    menus[week] = menu;
  }
  return menus;
}

function parseChecks(value: unknown): AppData['checks'] {
  if (!isRecord(value)) return {};
  const checks: AppData['checks'] = {};
  for (const [week, raw] of Object.entries(value)) {
    if (!isWeekKey(week) || !isRecord(raw)) continue;
    checks[week] = { prep: stringsIn(raw.prep), shopping: stringsIn(raw.shopping) };
  }
  return checks;
}

/** Reads saved data, upgrading version 1 and falling back to defaults for anything missing or invalid. Never throws. */
export function load(storage: StorageLike | null, today: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return defaultData(today);
  }
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2)) return defaultData(today);
  const settings = parseSettings(raw.settings, today);
  const eaten = parseEaten(raw.eaten);
  // Version 1 had a fixed plan: keep settings and eaten history; its shopping checks don't apply any more.
  if (raw.version === 1) return { ...defaultData(today), settings, eaten };
  const customMeals = parseCustomMeals(raw.customMeals);
  return {
    version: 2,
    settings,
    eaten,
    menus: parseMenus(raw.menus, customMeals),
    customMeals,
    checks: parseChecks(raw.checks),
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
