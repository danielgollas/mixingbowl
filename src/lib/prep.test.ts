import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/meals';
import type { Meal, Slot } from '../data/types';
import { formatQuantity, formatWeight } from './format';
import { formatPortion, householdTotals, packsToBuy, planInput, prepList, shoppingList, weekPlan, weekTotals, type PlanInput } from './prep';
import { defaultData, parseData } from './storage';
import { scaleDay, type ScaledDay } from './scaling';

const day = (...meals: Meal[]): ScaledDay =>
  scaleDay(
    meals.map((meal) => ({ slot: meal.kind === 'bowl' ? 'dinner' : 'snack', meal })),
    null,
    false,
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
      details: ['uses 2.6 blocks extra-firm tofu (14 oz each)'],
    });
  });

  it('does not repeat the pack count when the amount is already in packs', () => {
    const days = Array.from({ length: 7 }, () => unscaled(PRESETS['bbq-cabbage-bowl']));
    expect(line(prepList(weekTotals(days)), 'charred-cabbage')).toMatchObject({ amount: '1¾ heads', details: [] });
    const batons = prepList(weekTotals([day(PRESETS['veggie-batons'])]));
    expect(line(batons, 'veggie-batons')?.details).toEqual(['uses 1 cucumber']);
  });
});

describe('pack sizes', () => {
  const totals = weekTotals([unscaled(PRESETS['scramble-bowl'])]);

  it('shows grams in metric', () => {
    const tofu = shoppingList(totals, 'kg').flatMap((g) => g.lines).find((l) => l.id === 'tofu-firm');
    expect(tofu?.note).toContain('397 g each');
    expect(line(prepList(totals, [], 'kg'), 'tofu-scramble')?.details[0]).toContain('(397 g each)');
  });

  it('leaves out produce counted by the piece', () => {
    const onions = shoppingList(weekTotals([unscaled(PRESETS['crumble-taco-bowl'])])).flatMap((g) => g.lines).find((l) => l.id === 'onion');
    expect(onions?.note).not.toContain('each');
  });
});

describe('shoppingList', () => {
  const groups = shoppingList(weekTotals(Array.from({ length: 7 }, () => unscaled(PRESETS['scramble-bowl']))));
  const item = (id: string) => groups.flatMap((g) => g.lines).find((l) => l.id === id);

  it('rounds packaged foods up to whole packs', () => {
    expect(item('tofu-firm')).toMatchObject({ amount: '3 blocks', note: 'uses 2.6 · 14 oz each' });
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

  it('lists the spices that seasoned parts need', () => {
    const fajita: Meal = { id: 'x', name: 'Fajita bowl', kind: 'bowl', parts: ['garlic-lime-rice', 'cajun-tempeh', 'fajita-peppers'] };
    const spices = shoppingList(weekTotals([day(fajita)])).find((g) => g.category === 'Spices & Baking');
    const ids = spices?.lines.map((l) => l.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining(['cumin', 'cajun-seasoning', 'chili-powder']));
  });

  it('buys whole packs with a little tolerance', () => {
    expect(packsToBuy(0.2)).toBe(1);
    expect(packsToBuy(2.6)).toBe(3);
    expect(packsToBuy(3.02)).toBe(3);
    expect(packsToBuy(3.1)).toBe(4);
  });
});

describe('weekPlan', () => {
  const input: PlanInput = { meals: ['snack', 'dinner'], menus: {}, customMeals: {}, proteinMin: null, kcal: { min: 1200, max: 1500 }, scale: true };

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

describe('householdTotals', () => {
  const data = {
    ...defaultData('2026-09-14'),
    people: [
      { id: 'me', name: 'Me', targetWeight: 160, meals: ['snack', 'dinner'] as Slot[], scale: true, maintenance: null },
      { id: 'alex', name: 'Alex', targetWeight: null, meals: ['dinner'] as Slot[], scale: true, maintenance: null },
    ],
  };

  it('adds each person’s own scaled week', () => {
    const { totals, people } = householdTotals(data, 1);
    const me = people[0].totals.components.get('tofu-scramble')!;
    const alex = people[1].totals.components.get('tofu-scramble')!;
    expect(totals.components.get('tofu-scramble')).toBeCloseTo(me + alex, 5);
    expect(totals.meals).toBe(21);
    expect(people[1].totals.components.get('protein-fluff')).toBeUndefined();
  });

  it('uses one base portion for a person with scaling off', () => {
    const unscaledAlex = { ...data, people: [data.people[0], { ...data.people[1], scale: false, maintenance: null }] };
    const { people } = householdTotals(unscaledAlex, 1);
    expect(people[1].totals.components.get('tofu-scramble')).toBe(4);
    expect(people[1].totals.components.get('brown-rice')).toBe(7);
  });

  it('adds a share line per component only for more than one person', () => {
    const { totals, people } = householdTotals(data, 1);
    const shared = line(prepList(totals, people), 'protein-fluff');
    expect(shared?.shares).toBe('Me 6 servings');
    expect(line(prepList(totals, people), 'tofu-scramble')?.shares).toMatch(/^Me [\d,]+ g tofu · Alex [\d,]+ g tofu$/);
    expect(line(prepList(totals, people.slice(0, 1)), 'tofu-scramble')?.shares).toBeNull();
  });
});

describe('a second snack', () => {
  const data = defaultData('2026-09-14');
  const person = { ...data.people[0], meals: ['snack', 'dinner', 'snack2'] as Slot[] };

  it('plans both snacks for the day, with a default menu', () => {
    const [day] = weekPlan(planInput({ ...data, people: [person] }, person), 1);
    const snacks = day.meals.filter((m) => m.slot === 'snack' || m.slot === 'snack2');
    expect(snacks.map((m) => m.slot)).toEqual(['snack', 'snack2']);
    expect(snacks.every((m) => m.meal.kind === 'snack')).toBe(true);
  });

  it('survives a save and load', () => {
    const saved = JSON.stringify({ ...data, people: [person] });
    expect(parseData(saved, '2026-09-14')!.people[0].meals).toEqual(['snack', 'dinner', 'snack2']);
  });

  it('takes its own menu, and refuses a bowl', () => {
    const menu = { snack2: [{ mealId: 'banana-berries', days: 7 }, { mealId: 'scramble-bowl', days: 1 }] };
    const saved = JSON.stringify({ ...data, menus: { 1: menu } });
    expect(parseData(saved, '2026-09-14')!.menus[1].snack2).toEqual([{ mealId: 'banana-berries', days: 7 }]);
  });
});

describe('a weekly fast', () => {
  const base = defaultData('2026-09-14');
  const faster = { ...base.people[0], fastDay: 3 };
  const other = { ...base.people[0], id: 'other', name: 'Other' };
  const data = { ...base, people: [faster, other] };

  it('empties that day for that person only', () => {
    const days = weekPlan(planInput(data, faster), 1);
    expect(days[2].meals).toEqual([]);
    expect(days[2].shortBy).toEqual({ kcal: 0, protein: 0 });
    expect(days[1].meals.length).toBeGreaterThan(0);
    expect(weekPlan(planInput(data, other), 1)[2].meals.length).toBeGreaterThan(0);
  });

  it('takes their portions off the shopping and prep totals', () => {
    const alone = { ...data, people: [{ ...faster, fastDay: undefined }, other] };
    const count = (d: typeof data) => householdTotals(d, 1).totals.meals;
    expect(count(alone) - count(data)).toBe(2);
  });

  it('keeps a valid day and drops a bad one', () => {
    const load = (fastDay: unknown) =>
      parseData(JSON.stringify({ ...base, people: [{ ...base.people[0], fastDay }] }), '2026-09-14')!.people[0].fastDay;
    expect(load(3)).toBe(3);
    expect(load(8)).toBeUndefined();
  });
});
