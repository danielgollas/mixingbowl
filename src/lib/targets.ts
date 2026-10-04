export const KCAL_MIN = 1200;
export const KCAL_MAX = 1500;
export const LB_PER_KG = 2.20462;

export type WeightUnit = 'lb' | 'kg';

export interface Range {
  min: number;
  max: number;
}

/** Brief: 0.8–1.0 g protein per lb of target body weight. */
export function proteinTarget(weight: number | null, unit: WeightUnit): Range | null {
  if (weight === null) return null;
  const lb = unit === 'kg' ? weight * LB_PER_KG : weight;
  return { min: 0.8 * lb, max: lb };
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
