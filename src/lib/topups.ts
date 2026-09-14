import { ADDONS } from '../data/addons';
import { FOODS } from '../data/foods';
import type { FoodId, Nutrition } from '../data/types';
import { addNutrition, foodNutrition } from './nutrition';

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
  kg: { min: 36, max: 272 },
};

export const isValidWeight = (weight: number, unit: WeightUnit): boolean =>
  Number.isFinite(weight) && weight >= WEIGHT_RANGE[unit].min && weight <= WEIGHT_RANGE[unit].max;

/** Converts a weight between units, rounded to one decimal. */
export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  const converted = from === 'lb' ? weight / LB_PER_KG : weight * LB_PER_KG;
  return Math.round(converted * 10) / 10;
}

export interface TopUpItem extends Nutrition {
  foodId: FoodId;
  name: string;
  grams: number;
}

export interface TopUpResult {
  items: TopUpItem[];
  after: Nutrition;
  unmet: Nutrition;
}

const proteinPerKcal = (foodId: FoodId) => FOODS[foodId].proteinPer100g / FOODS[foodId].kcalPer100g;

// Array.prototype.sort is stable, so equal densities keep catalogue order.
const RANKED = [...ADDONS].sort((a, b) => proteinPerKcal(b.foodId) - proteinPerKcal(a.foodId));

/**
 * Greedily add capped portions of the most protein-dense add-ons until the day reaches the kcal floor
 * and (when known) the protein floor, without ever exceeding the kcal ceiling.
 */
export function suggestTopUps(planned: Nutrition, proteinMin: number | null): TopUpResult {
  const portions = new Map<FoodId, number>(); // insertion order = order each food was first picked
  let after = planned;
  const isShort = () => after.kcal < KCAL_MIN || (proteinMin !== null && after.protein < proteinMin);

  while (isShort()) {
    const next = RANKED.find(
      (addon) =>
        (portions.get(addon.foodId) ?? 0) < addon.maxSteps &&
        after.kcal + foodNutrition(addon.foodId, addon.stepGrams).kcal <= KCAL_MAX,
    );
    if (!next) break;
    portions.set(next.foodId, (portions.get(next.foodId) ?? 0) + 1);
    after = addNutrition(after, foodNutrition(next.foodId, next.stepGrams));
  }

  const items = [...portions].map(([foodId, count]): TopUpItem => {
    const grams = count * ADDONS.find((addon) => addon.foodId === foodId)!.stepGrams;
    return { foodId, name: FOODS[foodId].name, grams, ...foodNutrition(foodId, grams) };
  });

  return {
    items,
    after,
    unmet: {
      kcal: Math.max(0, KCAL_MIN - after.kcal),
      protein: proteinMin === null ? 0 : Math.max(0, proteinMin - after.protein),
    },
  };
}
