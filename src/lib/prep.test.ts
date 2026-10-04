import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/meals';
import type { Meal } from '../data/types';
import { formatQuantity, formatWeight } from './format';
import { formatPortion, packsToBuy, prepList, shoppingList, weekPlan, weekTotals, type PlanInput } from './prep';
import { scaleDay, type ScaledDay } from './scaling';

const day = (...meals: Meal[]): ScaledDay =>
  scaleDay(
    meals.map((meal) => ({ slot: meal.kind === 'bowl' ? 'dinner' : 'snack', meal })),
    null,
  );

/** A day whose parts all stay at one serving: three bowls are well over the kcal floor. */
const unscaled = (...bowls: Meal[]): ScaledDay => {
  const scaled = scaleDay(
    bowls.map((meal) => ({ slot: 'dinner', meal })),
    null,
  );
  for (const meal of scaled.meals) for (const id of Object.keys(meal.servings)) meal.servings[id] = 1;
  return scaled;
};

const line = (groups: ReturnType<typeof prepList>, id: string) =>
  groups.flatMap((g) => g.lines).find((l) => l.id === id);

describe('weekTotals', () => {
  it('adds servings across days and expands components inside others', () => {
    const totals = weekTotals([day(PRESETS['veggie-batons']), day(PRESETS['veggie-batons'])]);
    expect(totals.components.get('veggie-batons')).toBe(2);
    expect(totals.components.get('dill-pickle-dip')).toBe(2);
    expect(totals.foods.get('cucumber')).toBe(600);
    expect(totals.meals).toBe(2);
  });

  it('folds combo beds into the beds they are made from', () => {
    const totals = weekTotals([unscaled(PRESETS['buffalo-tempeh-bowl'], PRESETS['scramble-bowl'])]);
    expect(totals.components.get('lentils-rice')).toBe(1);
    expect(totals.components.get('brown-rice')).toBe(1.5);
    expect(totals.components.get('lentils')).toBe(0.5);
  });
});

describe('prepList', () => {
  it('lists only components you make, grouped by role in bowl order', () => {
    const groups = prepList(weekTotals([unscaled(PRESETS['buffalo-tempeh-bowl'], PRESETS['scramble-bowl'])]));
    expect(groups.map((g) => g.title)).toEqual(['Beds', 'Proteins', 'Veg', 'Sauces', 'Toppings']);
    expect(line(groups, 'lentils-rice')).toBeUndefined();
    expect(line(groups, 'brown-rice')?.amount).toBe('1½ cups cooked');
  });

  it('shows the dry amount for beds and packs used for packaged foods', () => {
    const days = Array.from({ length: 7 }, () => unscaled(PRESETS['scramble-bowl']));
    const groups = prepList(weekTotals(days));
    expect(line(groups, 'brown-rice')).toMatchObject({ amount: '7 cups cooked', details: ['≈ 2⅓ cups dry'] });
    expect(line(groups, 'tofu-scramble')).toMatchObject({
      amount: '1,050 g tofu',
      details: ['uses 2.6 blocks extra-firm tofu'],
    });
  });

  it('does not repeat the pack count when the amount is already in packs', () => {
    const days = Array.from({ length: 7 }, () => unscaled(PRESETS['bbq-cabbage-bowl']));
    expect(line(prepList(weekTotals(days)), 'charred-cabbage')).toMatchObject({ amount: '1¾ heads', details: [] });
    const batons = prepList(weekTotals([day(PRESETS['veggie-batons'])]));
    expect(line(batons, 'veggie-batons')?.details).toEqual(['uses 1 cucumber']);
  });
});

describe('shoppingList', () => {
  const groups = shoppingList(weekTotals(Array.from({ length: 7 }, () => unscaled(PRESETS['scramble-bowl']))));
  const item = (id: string) => groups.flatMap((g) => g.lines).find((l) => l.id === id);

  it('rounds packaged foods up to whole packs', () => {
    expect(item('tofu-firm')).toMatchObject({ amount: '3 blocks', note: 'uses 2.6' });
  });

  it('shows beds as dry weight and weighs other produce', () => {
    expect(item('brown-rice')?.amount).toBe(`≈ ${formatWeight((195 * 7) / 2.7)} dry`);
    expect(item('spinach')?.amount).toBe('≈ 420 g');
  });

  it('lists condiments and spices without amounts, and leaves out basics', () => {
    expect(item('garlic-powder')).toMatchObject({ amount: null, note: null });
    expect(item('salt-pepper')).toBeUndefined();
    expect(groups.map((g) => g.category)).not.toContain('Basics');
  });

  it('buys whole packs with a little tolerance', () => {
    expect(packsToBuy(0.2)).toBe(1);
    expect(packsToBuy(2.6)).toBe(3);
    expect(packsToBuy(3.02)).toBe(3);
    expect(packsToBuy(3.1)).toBe(4);
  });
});

describe('weekPlan', () => {
  const input: PlanInput = { meals: ['snack', 'dinner'], menus: {}, customMeals: {}, proteinMin: null };

  it('plans seven days from the resolved menu', () => {
    const days = weekPlan(input, 1);
    expect(days).toHaveLength(7);
    expect(days[0].meals.map((m) => m.meal.id)).toEqual(['protein-fluff', 'scramble-bowl']);
    expect(days[6].meals.map((m) => m.meal.id)).toEqual(['veggie-batons', 'crispy-tofu-bowl']);
  });

  it('leaves unplanned days without that meal', () => {
    const days = weekPlan({ ...input, menus: { 1: { dinner: [{ mealId: 'scramble-bowl', days: 5 }] } } }, 1);
    expect(days[5].meals.map((m) => m.slot)).toEqual(['snack']);
    expect(weekTotals(days).meals).toBe(12);
  });
});

describe('formatting', () => {
  it('formats kitchen quantities as fractions', () => {
    expect(formatQuantity(1)).toBe('1');
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(7 / 3)).toBe('2⅓');
    expect(formatQuantity(2.6)).toBe('2.6');
  });

  it('formats portions in grams or units', () => {
    expect(formatPortion({ amount: 150, unit: 'g tofu', units: 'g tofu' }, 1.5)).toBe('225 g tofu');
    expect(formatPortion({ amount: 1, unit: 'cup cooked', units: 'cups cooked' }, 1)).toBe('1 cup cooked');
    expect(formatPortion({ amount: 0.25, unit: 'head', units: 'heads' }, 2)).toBe('½ head');
  });

  it('formats weights', () => {
    expect(formatWeight(424)).toBe('420 g');
    expect(formatWeight(3)).toBe('10 g');
    expect(formatWeight(1234)).toBe('1.2 kg');
  });
});
