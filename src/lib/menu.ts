import { DEFAULT_MENU, getPreset } from '../data/meals';
import type { Meal, MealId, MenuEntry, Slot, WeekMenu } from '../data/types';
import type { PlannedMeal } from './scaling';

/** Saved menus keyed by program week number. */
export type Menus = Record<string, WeekMenu>;
export type CustomMeals = Record<MealId, Meal>;

export const findMeal = (id: MealId, custom: CustomMeals): Meal | undefined =>
  getPreset(id) ?? (Object.hasOwn(custom, id) ? custom[id] : undefined);

/** The entries for one meal in a week: that week's, else the nearest earlier week's, else the default. */
export function resolveEntries(menus: Menus, week: number, slot: Slot): MenuEntry[] {
  const saved = Object.keys(menus)
    .map(Number)
    .filter((w) => w <= week && menus[w]?.[slot] !== undefined)
    .sort((a, b) => b - a);
  return saved.length > 0 ? menus[saved[0]][slot]! : DEFAULT_MENU[slot];
}

export const resolveMenu = (menus: Menus, week: number): Required<WeekMenu> => ({
  breakfast: resolveEntries(menus, week, 'breakfast'),
  lunch: resolveEntries(menus, week, 'lunch'),
  snack: resolveEntries(menus, week, 'snack'),
  dinner: resolveEntries(menus, week, 'dinner'),
});

export const plannedDays = (entries: MenuEntry[]): number => entries.reduce((sum, e) => sum + e.days, 0);

/** Entries cover days in order: the first entry's days come first. Null when the day is unplanned. */
export function entryForDay(entries: MenuEntry[], day: number): MenuEntry | null {
  let end = 0;
  for (const entry of entries) {
    end += entry.days;
    if (day <= end) return entry;
  }
  return null;
}

/** The first and last program day an entry covers. */
export function entryDays(entries: MenuEntry[], index: number): { from: number; to: number } {
  const from = plannedDays(entries.slice(0, index)) + 1;
  return { from, to: from + entries[index].days - 1 };
}

/** The meals planned on one day of a week, for the given slots in order. Unplanned slots are left out. */
export function plannedMeals(menu: WeekMenu, slots: readonly Slot[], day: number, custom: CustomMeals): PlannedMeal[] {
  const meals: PlannedMeal[] = [];
  for (const slot of slots) {
    const entry = entryForDay(menu[slot] ?? [], day);
    const meal = entry && findMeal(entry.mealId, custom);
    if (meal) meals.push({ slot, meal });
  }
  return meals;
}
