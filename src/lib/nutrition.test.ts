import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/meals';
import type { Component, Food } from '../data/types';
import { componentNutrition, foodNutrition, mealNutrition } from './nutrition';

describe('foodNutrition', () => {
  it('scales per-100 g values by grams', () => {
    const n = foodNutrition('tofu-firm', 150);
    expect(n.kcal).toBeCloseTo(216, 5);
    expect(n.protein).toBeCloseTo(25.95, 5);
  });

  it('is zero for "to taste" ingredients', () => {
    expect(foodNutrition('garlic-powder', 0)).toEqual({ kcal: 0, protein: 0 });
  });

  it('throws on an unknown food, including inherited object keys', () => {
    expect(() => foodNutrition('unobtainium', 10)).toThrow(/unobtainium/);
    expect(() => foodNutrition('toString', 10)).toThrow(/Unknown food: toString/);
  });
});

describe('componentNutrition', () => {
  const foods: Record<string, Food> = {
    bean: { id: 'bean', name: 'Bean', kcalPer100g: 100, proteinPer100g: 10, category: 'Proteins' },
    leaf: { id: 'leaf', name: 'Leaf', kcalPer100g: 20, proteinPer100g: 2, category: 'Produce' },
  };
  const base: Omit<Component, 'id' | 'name' | 'ingredients' | 'uses'> = {
    role: 'veg',
    portion: { amount: 1, unit: 'serving', units: 'servings' },
    methods: ['no-cook'],
    steps: ['Eat.'],
    source: 'derived',
  };
  const components: Record<string, Component> = {
    dip: { ...base, id: 'dip', name: 'Dip', ingredients: [{ foodId: 'bean', grams: 50, amount: '' }], uses: [] },
    plate: {
      ...base,
      id: 'plate',
      name: 'Plate',
      ingredients: [{ foodId: 'leaf', grams: 200, amount: '' }],
      uses: [{ componentId: 'dip', servings: 2 }],
    },
  };

  it('adds ingredients and the components it uses, times their servings', () => {
    const n = componentNutrition('plate', components, foods);
    expect(n.kcal).toBeCloseTo(40 + 2 * 50, 5);
    expect(n.protein).toBeCloseTo(4 + 2 * 5, 5);
  });

  it('makes a combo bed the average of its two beds', () => {
    const combo = componentNutrition('lentils-rice');
    const rice = componentNutrition('brown-rice');
    const lentils = componentNutrition('lentils');
    expect(combo.kcal).toBeCloseTo((rice.kcal + lentils.kcal) / 2, 5);
  });

  it('throws on an unknown component', () => {
    expect(() => componentNutrition('nope')).toThrow(/Unknown component: nope/);
    expect(() => componentNutrition('constructor')).toThrow(/Unknown component: constructor/);
  });
});

describe('mealNutrition', () => {
  const bowl = PRESETS['scramble-bowl'];

  it('adds every part at one serving', () => {
    const sum = bowl.parts.reduce((total, id) => total + componentNutrition(id).kcal, 0);
    expect(mealNutrition(bowl).kcal).toBeCloseTo(sum, 5);
  });

  it('multiplies parts by their servings', () => {
    const scramble = componentNutrition('tofu-scramble');
    const scaled = mealNutrition(bowl, { 'tofu-scramble': 1.5 });
    expect(scaled.kcal).toBeCloseTo(mealNutrition(bowl).kcal + scramble.kcal * 0.5, 5);
    expect(scaled.protein).toBeCloseTo(mealNutrition(bowl).protein + scramble.protein * 0.5, 5);
  });

  it('estimates the Scramble Bowl at about 608 kcal and 46 g protein', () => {
    const n = mealNutrition(bowl);
    expect(n.kcal).toBeCloseTo(607.8, 0);
    expect(n.protein).toBeCloseTo(45.8, 0);
  });
});
