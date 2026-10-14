import { describe, expect, it } from 'vitest';
import { COMPONENT_LIST } from '../data/components';
import { PRESET_MEALS } from '../data/meals';
import type { Meal } from '../data/types';
import { filterItems, recipeItems, sortItems } from './explore';

const mine: Meal = { id: 'custom-1', name: 'Zebra Lentil Bowl', kind: 'bowl', parts: ['lentils-rice', 'seitan'] };
const items = recipeItems({ [mine.id]: mine });
const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe('recipeItems', () => {
  it('lists every preset, your own bowls, and every part', () => {
    expect(items).toHaveLength(PRESET_MEALS.length + 1 + COMPONENT_LIST.filter((c) => c.role !== 'snack').length);
    expect(items.find((i) => i.id === 'custom-1')).toMatchObject({ kind: 'bowl', href: '#/bowls/custom-1' });
    expect(items.find((i) => i.id === 'protein-fluff')).toMatchObject({ kind: 'snack', href: '#/bowls/protein-fluff' });
    expect(items.find((i) => i.id === 'seitan')).toMatchObject({ kind: 'part', role: 'protein', href: '#/components/seitan' });
  });
});

describe('filterItems', () => {
  it('finds names case-insensitively', () => {
    expect(ids(filterItems(items, 'ZEBRA lentil', 'all'))).toEqual(['custom-1']);
  });

  it('finds ingredients, including those of parts inside parts', () => {
    const found = ids(filterItems(items, 'lentils', 'all'));
    expect(found).toContain('lentils-rice');
    expect(found).toContain('custom-1');
    expect(ids(filterItems(items, 'sesame seeds', 'bowls')).length).toBeGreaterThan(0);
  });

  it('filters by kind and role', () => {
    expect(filterItems(items, '', 'bowls').every((i) => i.kind === 'bowl')).toBe(true);
    expect(filterItems(items, '', 'snacks').every((i) => i.kind === 'snack')).toBe(true);
    const sauces = filterItems(items, '', 'sauce');
    expect(sauces.length).toBe(COMPONENT_LIST.filter((c) => c.role === 'sauce').length);
    expect(filterItems(items, '', 'all')).toHaveLength(items.length);
  });
});

describe('sortItems', () => {
  it('sorts by name, protein, calories and protein per calorie', () => {
    const byName = sortItems(items, 'name').map((i) => i.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    const protein = sortItems(items, 'protein').map((i) => i.nutrition.protein);
    expect(protein).toEqual([...protein].sort((a, b) => b - a));
    const kcal = sortItems(items, 'kcal').map((i) => i.nutrition.kcal);
    expect(kcal).toEqual([...kcal].sort((a, b) => a - b));
    const density = sortItems(items, 'density').map((i) => i.nutrition.protein / Math.max(1, i.nutrition.kcal));
    expect(density).toEqual([...density].sort((a, b) => b - a));
  });
});
