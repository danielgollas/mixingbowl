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
  unit: WeightUnit;
}

export interface Person {
  id: string;
  name: string;
  targetWeight: number | null;
  /** The meals this person eats, in slot order. Never empty. */
  meals: Slot[];
}

export const MAX_PEOPLE = 8;

export interface WeekChecks {
  prep: string[];
  shopping: string[];
}

export type EatenLog = Record<string, Slot[]>;

export interface AppData {
  version: 3;
  settings: Settings;
  /** Never empty. */
  people: Person[];
  /** Whose day Today shows. Always one of `people`. */
  activePerson: string;
  /** Per person id: eaten slots keyed by local date "YYYY-MM-DD". */
  eaten: Record<string, EatenLog>;
  /** Menus keyed by program week number. */
  menus: Menus;
  customMeals: CustomMeals;
  /** Checked prep component ids and shopping food ids, keyed by program week number. */
  checks: Record<string, WeekChecks>;
}

export const newPerson = (id: string, name: string): Person => ({
  id,
  name,
  targetWeight: null,
  meals: [...DEFAULT_MEALS],
});

export const defaultData = (today: string): AppData => ({
  version: 3,
  settings: { startDate: today, unit: 'lb' },
  people: [newPerson('me', 'Me')],
  activePerson: 'me',
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
  return {
    startDate: typeof s.startDate === 'string' && isIsoDate(s.startDate) ? s.startDate : today,
    unit: s.unit === 'kg' ? 'kg' : 'lb',
  };
}

function parsePerson(value: unknown, index: number): Person | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') return null;
  const meals = slotsIn(value.meals);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const weight = value.targetWeight;
  return {
    id: value.id,
    name: name || `Person ${index + 1}`,
    targetWeight: typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? weight : null,
    meals: meals.length > 0 ? meals : [...DEFAULT_MEALS],
  };
}

function parsePeople(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  const people: Person[] = [];
  for (const raw of value) {
    if (people.length === MAX_PEOPLE) break;
    const person = parsePerson(raw, people.length);
    if (person && !people.some((p) => p.id === person.id)) people.push(person);
  }
  return people;
}

function parseEatenLog(value: unknown): EatenLog {
  if (!isRecord(value)) return {};
  const eaten: EatenLog = {};
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

/** Reads saved data, upgrading older versions and falling back to defaults for anything invalid. Never throws. */
export function load(storage: StorageLike | null, today: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return defaultData(today);
  }
  if (!isRecord(raw) || ![1, 2, 3].includes(raw.version as number)) return defaultData(today);
  const settings = parseSettings(raw.settings, today);
  const customMeals = raw.version === 1 ? {} : parseCustomMeals(raw.customMeals);
  const shared = {
    version: 3 as const,
    settings,
    // Version 1 had a fixed plan, so it has no menus, and its shopping checks don't apply any more.
    menus: raw.version === 1 ? {} : parseMenus(raw.menus, customMeals),
    customMeals,
    checks: raw.version === 1 ? {} : parseChecks(raw.checks),
  };

  // Versions 1 and 2 had one person: their target weight, meals and eaten history move into "Me".
  if (raw.version !== 3) {
    const old = isRecord(raw.settings) ? raw.settings : {};
    const me = parsePerson({ id: 'me', name: 'Me', targetWeight: old.targetWeight, meals: old.meals }, 0)!;
    const log = parseEatenLog(raw.eaten);
    return { ...shared, people: [me], activePerson: 'me', eaten: Object.keys(log).length > 0 ? { me: log } : {} };
  }

  const people = parsePeople(raw.people);
  if (people.length === 0) people.push(newPerson('me', 'Me'));
  const eatenRaw = isRecord(raw.eaten) ? raw.eaten : {};
  const eaten: AppData['eaten'] = {};
  for (const person of people) {
    const log = parseEatenLog(eatenRaw[person.id]);
    if (Object.keys(log).length > 0) eaten[person.id] = log;
  }
  const active = people.find((p) => p.id === raw.activePerson) ?? people[0];
  return { ...shared, people, activePerson: active.id, eaten };
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
