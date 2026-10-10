import { describe, expect, it } from 'vitest';
import { DEFAULT_MENU } from '../data/meals';
import type { Meal, MenuEntry } from '../data/types';
import { addEntry, entryDays, entryForDay, findMeal, householdMeals, plannedDays, plannedMeals, resolveEntries, resolveMenu } from './menu';

const entries: MenuEntry[] = [
  { mealId: 'scramble-bowl', days: 4 },
  { mealId: 'crispy-tofu-bowl', days: 2 },
];

describe('entryForDay', () => {
  it('fills days in order', () => {
    expect([1, 2, 3, 4, 5, 6].map((d) => entryForDay(entries, d)?.mealId)).toEqual([
      'scramble-bowl',
      'scramble-bowl',
      'scramble-bowl',
      'scramble-bowl',
      'crispy-tofu-bowl',
      'crispy-tofu-bowl',
    ]);
  });

  it('leaves the remaining days unplanned', () => {
    expect(entryForDay(entries, 7)).toBeNull();
    expect(entryForDay([], 1)).toBeNull();
  });

  it('reports each entry’s days and the total', () => {
    expect(entryDays(entries, 0)).toEqual({ from: 1, to: 4 });
    expect(entryDays(entries, 1)).toEqual({ from: 5, to: 6 });
    expect(plannedDays(entries)).toBe(6);
  });
});

describe('resolveEntries', () => {
  it('uses the default menu when nothing is saved', () => {
    expect(resolveMenu({}, 3)).toEqual(DEFAULT_MENU);
  });

  it('uses the week’s own entries, else the nearest earlier week’s', () => {
    const menus = { 2: { dinner: entries }, 4: { dinner: [{ mealId: 'seitan-soba-bowl', days: 7 }] } };
    expect(resolveEntries(menus, 1, 'dinner')).toBe(DEFAULT_MENU.dinner);
    expect(resolveEntries(menus, 2, 'dinner')).toBe(entries);
    expect(resolveEntries(menus, 3, 'dinner')).toBe(entries);
    expect(resolveEntries(menus, 9, 'dinner')).toEqual([{ mealId: 'seitan-soba-bowl', days: 7 }]);
  });

  it('resolves each meal on its own', () => {
    const menus = { 2: { dinner: entries } };
    expect(resolveEntries(menus, 2, 'snack')).toBe(DEFAULT_MENU.snack);
  });

  it('keeps an emptied meal empty instead of falling back', () => {
    expect(resolveEntries({ 1: { dinner: [] } }, 2, 'dinner')).toEqual([]);
  });
});

describe('plannedMeals', () => {
  const custom: Meal = { id: 'custom-1', name: 'Mine', kind: 'bowl', parts: ['quinoa', 'seitan'] };

  it('finds presets and your own meals', () => {
    expect(findMeal('scramble-bowl', {})?.name).toBe('Scramble Bowl');
    expect(findMeal('custom-1', { 'custom-1': custom })).toBe(custom);
    expect(findMeal('custom-1', {})).toBeUndefined();
    expect(findMeal('constructor', {})).toBeUndefined();
  });

  it('lists the day’s meal for each slot you eat, skipping unplanned ones', () => {
    const menu = { snack: DEFAULT_MENU.snack, dinner: [{ mealId: 'custom-1', days: 3 }] };
    const day2 = plannedMeals(menu, ['snack', 'dinner'], 2, { 'custom-1': custom });
    expect(day2.map((m) => [m.slot, m.meal.id])).toEqual([
      ['snack', 'protein-fluff'],
      ['dinner', 'custom-1'],
    ]);
    const day5 = plannedMeals(menu, ['snack', 'dinner'], 5, { 'custom-1': custom });
    expect(day5.map((m) => m.slot)).toEqual(['snack']);
  });
});

describe('addEntry', () => {
  it('fills the unplanned days', () => {
    expect(addEntry(entries, 'seitan-soba-bowl').at(-1)).toEqual({ mealId: 'seitan-soba-bowl', days: 1 });
    expect(addEntry([], 'seitan-soba-bowl')).toEqual([{ mealId: 'seitan-soba-bowl', days: 7 }]);
  });

  it('takes a day from the entry with the most days when the week is full', () => {
    const full: MenuEntry[] = [
      { mealId: 'a', days: 3 },
      { mealId: 'b', days: 3 },
      { mealId: 'c', days: 1 },
    ];
    expect(addEntry(full, 'd')).toEqual([
      { mealId: 'a', days: 3 },
      { mealId: 'b', days: 2 },
      { mealId: 'c', days: 1 },
      { mealId: 'd', days: 1 },
    ]);
  });

  it('allows up to seven different items', () => {
    let list: MenuEntry[] = [{ mealId: 'a', days: 7 }];
    for (const id of ['b', 'c', 'd', 'e', 'f', 'g', 'h']) list = addEntry(list, id);
    expect(list.map((e) => e.days)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(list.map((e) => e.mealId)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});

describe('householdMeals', () => {
  it('lists every meal anyone eats, in slot order', () => {
    expect(householdMeals([{ meals: ['dinner'] }, { meals: ['snack', 'dinner'] }, { meals: ['breakfast'] }])).toEqual([
      'breakfast',
      'snack',
      'dinner',
    ]);
  });
});
