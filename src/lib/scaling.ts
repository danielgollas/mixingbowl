import { getComponent } from '../data/components';
import type { ComponentId, Meal, Nutrition, Role, Slot } from '../data/types';
import { ZERO, addNutrition, componentNutrition, mealNutrition } from './nutrition';
import { KCAL_MAX, KCAL_MIN } from './targets';

export const STEP = 0.5;
/** Extra servings a part may grow by, per role. Other roles never scale. */
export const MAX_EXTRA: Partial<Record<Role, number>> = { protein: 2, bed: 1 };

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
  shortBy: Nutrition;
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

const density = (n: Nutrition) => (n.kcal > 0 ? n.protein / n.kcal : 0);

/**
 * Grows the day's bowl portions toward the kcal floor and (when known) the protein floor: protein parts
 * first, most protein per kcal first, then beds, in half servings, never past the kcal ceiling.
 */
export function scaleDay(planned: PlannedMeal[], proteinMin: number | null): ScaledDay {
  const candidates: Candidate[] = [];
  planned.forEach(({ meal }, index) => {
    if (meal.kind !== 'bowl') return;
    for (const part of meal.parts) {
      const role = getComponent(part)?.role;
      const max = role ? MAX_EXTRA[role] : undefined;
      if (!role || max === undefined) continue;
      const one = componentNutrition(part);
      candidates.push({
        meal: index,
        part,
        role,
        step: { kcal: one.kcal * STEP, protein: one.protein * STEP },
        steps: 0,
        maxSteps: max / STEP,
      });
    }
  });
  // Array.prototype.sort is stable, so ties keep meal order.
  const proteins = candidates.filter((c) => c.role === 'protein').sort((a, b) => density(b.step) - density(a.step));
  const beds = candidates.filter((c) => c.role === 'bed');

  const unscaled = planned.reduce((sum, { meal }) => addNutrition(sum, mealNutrition(meal)), ZERO);
  let total = unscaled;
  const isShort = () => total.kcal < KCAL_MIN || (proteinMin !== null && total.protein < proteinMin);
  const fits = (c: Candidate) => c.steps < c.maxSteps && total.kcal + c.step.kcal <= KCAL_MAX;

  while (isShort()) {
    const next = proteins.find(fits) ?? beds.find(fits);
    if (!next) break;
    next.steps += 1;
    total = addNutrition(total, next.step);
  }

  const meals = planned.map(({ slot, meal }, index): ScaledMeal => {
    const servings: Record<ComponentId, number> = Object.fromEntries(meal.parts.map((part) => [part, 1]));
    for (const c of candidates) if (c.meal === index) servings[c.part] += c.steps * STEP;
    return { slot, meal, servings, nutrition: mealNutrition(meal, servings) };
  });

  return {
    meals,
    total,
    shortBy: {
      kcal: Math.max(0, KCAL_MIN - total.kcal),
      protein: proteinMin === null ? 0 : Math.max(0, proteinMin - total.protein),
    },
    over: Math.max(0, unscaled.kcal - KCAL_MAX),
  };
}
