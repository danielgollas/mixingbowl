import { getComponent } from '../data/components';
import { FOODS } from '../data/foods';
import type { ComponentId, Meal, Nutrition, Role, Slot } from '../data/types';
import { ZERO, addNutrition, componentNutrition, mealNutrition, scaleNutrition } from './nutrition';
import { KCAL_MAX, KCAL_MIN, type Range } from './targets';

export const STEP = 0.5;
/** Extra servings a part may grow by, per role. Sauces and toppings never scale. */
export const MAX_EXTRA: Partial<Record<Role, number>> = { veg: 1, protein: 1, bed: 1, snack: 1 };
/** The order a short day grows in, one half serving per role each time round. */
const ROUND: Role[] = ['veg', 'protein', 'bed', 'snack'];
/** Every bowl has at least this much produce in its vegetable parts, about five servings. */
export const VEG_MIN_GRAMS = 400;

const produceGrams = (part: ComponentId) =>
  (getComponent(part)?.ingredients ?? [])
    .filter((i) => FOODS[i.foodId]?.category === 'Produce')
    .reduce((sum, i) => sum + i.grams, 0);
const vegParts = (meal: Meal) => meal.parts.filter((part) => getComponent(part)?.role === 'veg');

/** Grams of produce in a meal's vegetable parts. */
export function vegGrams(meal: Meal, servings: Record<ComponentId, number> = {}): number {
  return vegParts(meal).reduce((sum, part) => sum + produceGrams(part) * (servings[part] ?? 1), 0);
}

/** Vegetable servings that bring a meal up to `VEG_MIN_GRAMS`, growing its veg parts evenly in half servings. */
function vegServings(meal: Meal): Record<ComponentId, number> {
  const parts = vegParts(meal).filter((part) => produceGrams(part) > 0);
  const servings: Record<ComponentId, number> = Object.fromEntries(parts.map((part) => [part, 1]));
  for (let i = 0; parts.length > 0 && vegGrams(meal, servings) < VEG_MIN_GRAMS; i++)
    servings[parts[i % parts.length]] += STEP;
  return servings;
}

export interface PlannedMeal {
  slot: Slot;
  meal: Meal;
}

export interface ScaledMeal extends PlannedMeal {
  /** Servings per part; every part is listed. */
  servings: Record<ComponentId, number>;
  nutrition: Nutrition;
}

export interface ScaledDay {
  meals: ScaledMeal[];
  total: Nutrition;
  /** What's still missing after scaling (zero when met). */
  shortBy: { kcal: number; protein: number };
  /** How far the unscaled day is already over the kcal ceiling. */
  over: number;
}

interface Candidate {
  meal: number;
  part: ComponentId;
  role: Role;
  step: Nutrition;
  steps: number;
  maxSteps: number;
}

const ones = (meal: Meal): Record<ComponentId, number> => Object.fromEntries(meal.parts.map((part) => [part, 1]));
const density = (n: Nutrition) => (n.kcal > 0 ? n.protein / n.kcal : 0);

/**
 * With `scale` off, every part stays at one serving.
 *
 * Every bowl first gets `VEG_MIN_GRAMS` of vegetables, whatever the calories. Then the day's whole foods grow
 * together toward the kcal floor, in half servings: veg, protein, bed and snack each take a turn, evenly within a role, and the protein with the most protein per kcal goes first. Once
 * calories are met, only protein grows toward the protein floor. Never past the kcal ceiling.
 */
export function scaleDay(
  planned: PlannedMeal[],
  proteinMin: number | null,
  scale = true,
  kcal: Range = { min: KCAL_MIN, max: KCAL_MAX },
): ScaledDay {
  const veg = planned.map(({ meal }) => (scale ? vegServings(meal) : {}));
  const candidates: Candidate[] = [];
  planned.forEach(({ meal }, index) => {
    for (const part of meal.parts) {
      const role = getComponent(part)?.role;
      const max = role ? MAX_EXTRA[role] : undefined;
      if (!role || max === undefined) continue;
      const one = componentNutrition(part);
      candidates.push({
        meal: index,
        part,
        role,
        step: scaleNutrition(one, STEP),
        steps: 0,
        // Veg starts at its 400 g servings, and grows on a short day only while that's under double.
        maxSteps: Math.max(0, 1 + max - (veg[index][part] ?? 1)) / STEP,
      });
    }
  });
  // Array.prototype.sort is stable, so ties keep meal order.
  candidates.sort((a, b) => density(b.step) - density(a.step));

  const unscaled = planned.reduce((sum, { meal }) => addNutrition(sum, mealNutrition(meal)), ZERO);
  let total = planned.reduce((sum, { meal }, i) => addNutrition(sum, mealNutrition(meal, { ...ones(meal), ...veg[i] })), ZERO);
  const kcalShort = () => total.kcal < kcal.min;
  const proteinShort = () => proteinMin !== null && total.protein < proteinMin;
  const fits = (c: Candidate) => c.steps < c.maxSteps && total.kcal + c.step.kcal <= kcal.max;
  /** Adds half a serving to the part of this role that has grown least. */
  const grow = (role: Role) => {
    const open = candidates.filter((c) => c.role === role && fits(c));
    if (open.length === 0) return false;
    const next = open.reduce((least, c) => (c.steps < least.steps ? c : least));
    next.steps += 1;
    total = addNutrition(total, next.step);
    return true;
  };

  while (scale && (kcalShort() || proteinShort())) {
    const roles = kcalShort() ? ROUND : (['protein'] as Role[]);
    let grew = false;
    for (const role of roles) {
      if (!kcalShort() && !proteinShort()) break;
      if (role === 'protein' || kcalShort()) grew = grow(role) || grew;
    }
    if (!grew) break;
  }

  const meals = planned.map(({ slot, meal }, index): ScaledMeal => {
    const servings: Record<ComponentId, number> = { ...ones(meal), ...veg[index] };
    for (const c of candidates) if (c.meal === index) servings[c.part] += c.steps * STEP;
    return { slot, meal, servings, nutrition: mealNutrition(meal, servings) };
  });

  return {
    meals,
    total,
    // Without scaling there's no target to fall short of or go over.
    shortBy: {
      kcal: scale ? Math.max(0, kcal.min - total.kcal) : 0,
      protein: scale && proteinMin !== null ? Math.max(0, proteinMin - total.protein) : 0,
    },
    over: scale ? Math.max(0, unscaled.kcal - kcal.max) : 0,
  };
}
