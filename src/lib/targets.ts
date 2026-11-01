import type { Person } from './storage';

/** The day's calories when a person's maintenance isn't known. */
export const KCAL_MIN = 1200;
export const KCAL_MAX = 1500;
/** Lowest daily target: KCAL_MIN, or this for men. */
export const KCAL_FLOOR_MALE = 1500;
/** How far past the target a day's portions may grow. */
const KCAL_MARGIN = 150;
export const DEFAULT_DEFICIT = 500;
export const DEFICIT_RANGE = { min: 0, max: 1500 } as const;
export const LB_PER_KG = 2.20462;

export type WeightUnit = 'lb' | 'kg';

export interface Range {
  min: number;
  max: number;
}

/** 0.7–1.0 g protein per lb of target body weight. */
export function proteinTarget(weight: number | null, unit: WeightUnit): Range | null {
  if (weight === null) return null;
  const lb = unit === 'kg' ? weight * LB_PER_KG : weight;
  return { min: 0.7 * lb, max: lb };
}

/** A person's daily calories: maintenance less their deficit, above the floor and never above maintenance. */
export function calorieRange({ maintenance, deficit = DEFAULT_DEFICIT, body }: Person): Range {
  if (maintenance === null) return { min: KCAL_MIN, max: KCAL_MAX };
  const floor = body?.sex === 'male' ? KCAL_FLOOR_MALE : KCAL_MIN;
  const target = Math.min(maintenance, Math.max(floor, maintenance - deficit));
  return { min: target, max: target + KCAL_MARGIN };
}

export const WEIGHT_RANGE: Record<WeightUnit, Range> = {
  lb: { min: 80, max: 600 },
  // The lb range in kg, rounded inward to one decimal so a weight valid in one unit stays valid in the other.
  kg: { min: 36.3, max: 272.1 },
};

export const isValidWeight = (weight: number, unit: WeightUnit): boolean =>
  Number.isFinite(weight) && weight >= WEIGHT_RANGE[unit].min && weight <= WEIGHT_RANGE[unit].max;

/** Converts a weight between units, rounded to one decimal and kept within the new unit's range. */
export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  const converted = from === 'lb' ? weight / LB_PER_KG : weight * LB_PER_KG;
  const { min, max } = WEIGHT_RANGE[to];
  return Math.min(max, Math.max(min, Math.round(converted * 10) / 10));
}
