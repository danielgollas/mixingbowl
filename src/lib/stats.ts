import type { Nutrition } from '../data/types';
import { entryForDay, resolveMenu } from './menu';
import { ZERO, addNutrition, scaleNutrition } from './nutrition';
import { planInput, weekPlan } from './prep';
import type { AppData, Person } from './storage';
import { proteinTarget, type Range } from './targets';

export const KCAL_PER_LB = 3500;
export const KCAL_PER_KG = 7700;

export interface WeekStats {
  /** Planned nutrition per day, averaged over all seven days. */
  average: Nutrition;
  /** Days missing at least one of the person's meals. */
  unplannedDays: number;
  target: Range | null;
  /** Maintenance minus planned kcal; negative is a surplus. Null without maintenance calories. */
  deficit: { perDay: number; perWeek: number; weightPerWeek: number } | null;
}

/** One person's planned week, as averages per day, for the Menu. */
export function personWeekStats(data: AppData, person: Person, week: number): WeekStats {
  const days = weekPlan(planInput(data, person), week);
  const average = scaleNutrition(
    days.reduce((sum, day) => addNutrition(sum, day.total), ZERO),
    1 / 7,
  );
  const menu = resolveMenu(data.menus, week);
  let unplannedDays = 0;
  for (let day = 1; day <= 7; day++) {
    if (person.meals.some((slot) => !entryForDay(menu[slot], day))) unplannedDays++;
  }
  const perDay = person.maintenance === null ? null : person.maintenance - average.kcal;
  const perKcal = data.settings.unit === 'kg' ? KCAL_PER_KG : KCAL_PER_LB;
  return {
    average,
    unplannedDays,
    target: proteinTarget(person.targetWeight, data.settings.unit),
    deficit: perDay === null ? null : { perDay, perWeek: perDay * 7, weightPerWeek: (perDay * 7) / perKcal },
  };
}
