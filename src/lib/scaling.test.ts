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

  it('grows the protein in half servings until the kcal floor is met when no target is set', () => {
    const day = scaleDay([snack('protein-fluff'), dinner('scramble-bowl')], null);
    const bowl = day.meals[1];
    expect(bowl.servings['tofu-scramble']).toBe(3);
    expect(bowl.servings['brown-rice']).toBe(1);
    expect(day.total.kcal).toBeGreaterThanOrEqual(KCAL_MIN);
    expect(day.shortBy.protein).toBe(0);
  });

  it('grows beds once the protein is at +2, and reports what is still short', () => {
    const day = scaleDay([snack('protein-fluff'), dinner('scramble-bowl')], 128);
    const bowl = day.meals[1];
    expect(bowl.servings['tofu-scramble']).toBe(3);
    expect(bowl.servings['brown-rice']).toBe(2);
    expect(day.total.kcal).toBeLessThanOrEqual(KCAL_MAX);
    expect(day.total.kcal).toBeCloseTo(1469.3, 0);
    expect(day.shortBy.protein).toBeCloseTo(11.6, 0);
  });

  it('never scales veg, sauce or topping', () => {
    const day = scaleDay([snack('veggie-batons'), dinner('crispy-tofu-bowl')], 200);
    const { servings } = day.meals[1];
    for (const id of ['smashed-cucumber', 'crunchy-slaw', 'spicy-mayo', 'sesame-seeds']) expect(servings[id], id).toBe(1);
  });

  it('never scales snacks', () => {
    const day = scaleDay([snack('protein-fluff'), { slot: 'breakfast', meal: PRESETS['edamame-cup'] }], 128);
    for (const meal of day.meals) expect(Object.values(meal.servings)).toEqual([1]);
  });

  it('picks the protein with the most protein per kcal first across bowls', () => {
    const seitan: Meal = { id: 'a', name: 'A', kind: 'bowl', parts: ['shirataki', 'seitan'] };
    const tempeh: Meal = { id: 'b', name: 'B', kind: 'bowl', parts: ['shirataki', 'tempeh'] };
    const density = (id: string) => componentNutrition(id).protein / componentNutrition(id).kcal;
    expect(density('seitan')).toBeGreaterThan(density('tempeh'));
    const day = scaleDay([{ slot: 'lunch', meal: tempeh }, dinner(seitan)], null);
    expect(day.meals[1].servings.seitan).toBe(3);
    expect(day.meals[0].servings.tempeh).toBe(3);
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

  it('gives each meal its scaled nutrition', () => {
    const day = scaleDay([snack('protein-fluff'), dinner('scramble-bowl')], null);
    expect(day.meals[1].nutrition).toEqual(mealNutrition(PRESETS['scramble-bowl'], day.meals[1].servings));
    expect(day.total.kcal).toBeCloseTo(day.meals[0].nutrition.kcal + day.meals[1].nutrition.kcal, 5);
  });
});
