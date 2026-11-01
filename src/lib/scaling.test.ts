import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/meals';
import type { Meal } from '../data/types';
import { componentNutrition, mealNutrition } from './nutrition';
import { scaleDay, type PlannedMeal } from './scaling';
import { KCAL_MAX, KCAL_MIN } from './targets';

const snack = (id: string): PlannedMeal => ({ slot: 'snack', meal: PRESETS[id] });
const dinner = (meal: Meal | string): PlannedMeal => ({
  slot: 'dinner',
  meal: typeof meal === 'string' ? PRESETS[meal] : meal,
});

describe('scaleDay', () => {
  it('leaves an empty day empty', () => {
    const day = scaleDay([], null);
    expect(day.meals).toEqual([]);
    expect(day.shortBy).toEqual({ kcal: KCAL_MIN, protein: 0 });
  });

  it('changes nothing when the day already meets both targets', () => {
    const planned = [snack('protein-fluff'), dinner('scramble-bowl'), { slot: 'lunch' as const, meal: PRESETS['crispy-tofu-bowl'] }];
    const day = scaleDay(planned, 90);
    for (const meal of day.meals) expect(Object.values(meal.servings).every((s) => s === 1)).toBe(true);
    expect(day.shortBy).toEqual({ kcal: 0, protein: 0 });
  });

  it('grows veg, protein, bed and snack together in half servings', () => {
    const day = scaleDay([snack('veggie-batons'), dinner('crispy-tofu-bowl')], null, true, { min: 1500, max: 1650 });
    const { servings } = day.meals[1];
    for (const id of ['smashed-cucumber', 'crispy-tofu', 'brown-rice']) expect(servings[id], id).toBeGreaterThan(1);
    expect(day.meals[0].servings['veggie-batons']).toBeGreaterThan(1);
    for (const meal of day.meals) for (const s of Object.values(meal.servings)) expect((s * 2) % 1).toBe(0);
  });

  it('stops every part at double, and reports what is still short', () => {
    const day = scaleDay([snack('veggie-batons'), dinner('crispy-tofu-bowl')], 400, true, { min: 5000, max: 5150 });
    expect(Math.max(...day.meals.flatMap((m) => Object.values(m.servings)))).toBe(2);
    expect(day.meals[1].servings['crispy-tofu']).toBe(2);
    expect(day.shortBy.kcal).toBeGreaterThan(0);
    expect(day.shortBy.protein).toBeGreaterThan(0);
  });

  it('never scales sauce or topping', () => {
    const day = scaleDay([snack('veggie-batons'), dinner('crispy-tofu-bowl')], 200, true, { min: 5000, max: 5150 });
    const { servings } = day.meals[1];
    for (const id of ['spicy-mayo', 'sesame-seeds']) expect(servings[id], id).toBe(1);
  });

  it('adds only protein once calories are met', () => {
    const planned = [snack('veggie-batons'), dinner('crispy-tofu-bowl')];
    const kcal = scaleDay(planned, null, true, { min: 1, max: 5000 }).total.kcal;
    const day = scaleDay(planned, 90, true, { min: kcal, max: 5000 });
    expect(day.meals[1].servings['crispy-tofu']).toBeGreaterThan(1);
    expect(day.meals[1].servings['brown-rice']).toBe(1);
    expect(day.meals[0].servings['veggie-batons']).toBe(1);
  });

  it('picks the protein with the most protein per kcal first across bowls', () => {
    const seitan: Meal = { id: 'a', name: 'A', kind: 'bowl', parts: ['shirataki', 'seitan'] };
    const tempeh: Meal = { id: 'b', name: 'B', kind: 'bowl', parts: ['shirataki', 'tempeh'] };
    const density = (id: string) => componentNutrition(id).protein / componentNutrition(id).kcal;
    expect(density('seitan')).toBeGreaterThan(density('tempeh'));
    const day = scaleDay([{ slot: 'lunch', meal: tempeh }, dinner(seitan)], null);
    expect(day.meals[1].servings.seitan).toBeGreaterThanOrEqual(day.meals[0].servings.tempeh);
    expect(day.meals[1].servings.seitan).toBeGreaterThan(1);
  });

  it('never goes over the kcal ceiling, even if that leaves the protein short', () => {
    const day = scaleDay([snack('cabbage-chips'), dinner('crumble-taco-bowl'), { slot: 'lunch', meal: PRESETS['soy-curl-fajita-bowl'] }], 300);
    expect(day.total.kcal).toBeLessThanOrEqual(KCAL_MAX);
    expect(day.shortBy.protein).toBeGreaterThan(0);
  });

  it('reports how far an unscaled day is already over the ceiling', () => {
    const planned = [
      { slot: 'breakfast' as const, meal: PRESETS['cabbage-chips'] },
      { slot: 'lunch' as const, meal: PRESETS['crispy-tofu-bowl'] },
      snack('edamame-cup'),
      dinner('crumble-taco-bowl'),
    ];
    const day = scaleDay(planned, null);
    const unscaled = planned.reduce((sum, p) => sum + mealNutrition(p.meal).kcal, 0);
    expect(day.over).toBeCloseTo(unscaled - KCAL_MAX, 5);
    expect(day.meals.every((m) => Object.values(m.servings).every((s) => s === 1))).toBe(true);
  });

  it('keeps every portion at one serving when scaling is off, with nothing reported short or over', () => {
    const day = scaleDay([snack('protein-fluff'), dinner('scramble-bowl')], 128, false);
    for (const meal of day.meals) expect(Object.values(meal.servings).every((s) => s === 1)).toBe(true);
    expect(day.shortBy).toEqual({ kcal: 0, protein: 0 });
    expect(day.over).toBe(0);
    expect(day.total.kcal).toBeCloseTo(mealNutrition(PRESETS['protein-fluff']).kcal + mealNutrition(PRESETS['scramble-bowl']).kcal, 5);
  });

  it('gives each meal its scaled nutrition', () => {
    const day = scaleDay([snack('protein-fluff'), dinner('scramble-bowl')], null);
    expect(day.meals[1].nutrition).toEqual(mealNutrition(PRESETS['scramble-bowl'], day.meals[1].servings));
    expect(day.total.kcal).toBeCloseTo(day.meals[0].nutrition.kcal + day.meals[1].nutrition.kcal, 5);
  });
});
