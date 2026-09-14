import { describe, expect, it } from 'vitest';
import type { Food, Recipe } from '../data/types';
import { foodNutrition, patternTotals, recipeNutrition, slotsTotals } from './nutrition';

describe('foodNutrition', () => {
  it('scales per-100 g values by grams', () => {
    const n = foodNutrition('tofu-firm', 150);
    expect(n.kcal).toBeCloseTo(216, 5);
    expect(n.protein).toBeCloseTo(25.95, 5);
  });

  it('is zero for "to taste" ingredients', () => {
    expect(foodNutrition('garlic-powder', 0)).toEqual({ kcal: 0, protein: 0 });
  });

  it('throws on an unknown food', () => {
    expect(() => foodNutrition('unobtainium', 10)).toThrow(/unobtainium/);
  });
});

describe('recipeNutrition', () => {
  const foods: Record<string, Food> = {
    bean: { id: 'bean', name: 'Bean', kcalPer100g: 100, proteinPer100g: 10 },
    leaf: { id: 'leaf', name: 'Leaf', kcalPer100g: 20, proteinPer100g: 2 },
  };
  const base: Pick<Recipe, 'kind' | 'source' | 'methods' | 'steps'> = {
    kind: 'meal',
    source: 'derived',
    methods: ['no-cook'],
    steps: ['Eat.'],
  };
  const recipes: Record<string, Recipe> = {
    sauce: { ...base, id: 'sauce', name: 'Sauce', ingredients: [{ foodId: 'bean', grams: 50, amount: '' }], components: [] },
    bowl: {
      ...base,
      id: 'bowl',
      name: 'Bowl',
      ingredients: [{ foodId: 'leaf', grams: 200, amount: '' }],
      components: [{ recipeId: 'sauce', servings: 2 }],
    },
  };

  it('sums ingredients and components multiplied by servings', () => {
    const n = recipeNutrition('bowl', recipes, foods);
    expect(n.kcal).toBeCloseTo(40 + 2 * 50, 5);
    expect(n.protein).toBeCloseTo(4 + 2 * 5, 5);
  });

  it('includes the crispy tofu base inside the salad', () => {
    const salad = recipeNutrition('crispy-tofu-salad');
    const base = recipeNutrition('crispy-tofu');
    expect(salad.kcal).toBeCloseTo(base.kcal + 20.4 + 22.5 + 5.4, 5);
  });

  it('throws on an unknown recipe', () => {
    expect(() => recipeNutrition('nope')).toThrow(/nope/);
  });

  it('does not treat inherited object keys as ids', () => {
    expect(() => recipeNutrition('constructor')).toThrow(/Unknown recipe: constructor/);
    expect(() => foodNutrition('toString', 10)).toThrow(/Unknown food: toString/);
  });
});

describe('plan totals', () => {
  it('estimates Pattern A at ~1,025 kcal and ~91 g protein', () => {
    const n = patternTotals('A');
    expect(n.kcal).toBeCloseTo(1025.0, 0);
    expect(n.protein).toBeCloseTo(90.6, 0);
  });

  it('estimates Pattern B at ~769 kcal and ~63 g protein', () => {
    const n = patternTotals('B');
    expect(n.kcal).toBeCloseTo(769.2, 0);
    expect(n.protein).toBeCloseTo(63.0, 0);
  });

  it('sums only the given slots', () => {
    expect(slotsTotals('A', [])).toEqual({ kcal: 0, protein: 0 });
    expect(slotsTotals('A', ['breakfast'])).toEqual(recipeNutrition('tofu-scramble'));
    const all = slotsTotals('B', ['breakfast', 'lunch', 'snack', 'dinner']);
    expect(all.kcal).toBeCloseTo(patternTotals('B').kcal, 5);
  });
});
