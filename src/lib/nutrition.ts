import { COMPONENTS } from '../data/components';
import { FOODS } from '../data/foods';
import { NUTRIENTS, type Component, type ComponentId, type Food, type FoodId, type Meal, type Nutrition } from '../data/types';

export const ZERO: Nutrition = { kcal: 0, protein: 0, fat: 0, fiber: 0, sugar: 0 };

const combine = (fn: (nutrient: (typeof NUTRIENTS)[number]) => number): Nutrition =>
  Object.fromEntries(NUTRIENTS.map((n) => [n, fn(n)])) as Nutrition;

export const addNutrition = (a: Nutrition, b: Nutrition, times = 1): Nutrition => combine((n) => a[n] + b[n] * times);

export const scaleNutrition = (a: Nutrition, times: number): Nutrition => combine((n) => a[n] * times);

export function foodNutrition(foodId: FoodId, grams: number, foods: Record<FoodId, Food> = FOODS): Nutrition {
  const food = Object.hasOwn(foods, foodId) ? foods[foodId] : undefined;
  if (!food) throw new Error(`Unknown food: ${foodId}`);
  const per = grams / 100;
  return {
    kcal: food.kcalPer100g * per,
    protein: food.proteinPer100g * per,
    fat: food.fatPer100g * per,
    fiber: food.fiberPer100g * per,
    sugar: food.sugarPer100g * per,
  };
}

/** One portion of a component, including the components it uses. */
export function componentNutrition(
  id: ComponentId,
  components: Record<ComponentId, Component> = COMPONENTS,
  foods: Record<FoodId, Food> = FOODS,
): Nutrition {
  const component = Object.hasOwn(components, id) ? components[id] : undefined;
  if (!component) throw new Error(`Unknown component: ${id}`);
  let total = ZERO;
  for (const ingredient of component.ingredients) {
    total = addNutrition(total, foodNutrition(ingredient.foodId, ingredient.grams, foods));
  }
  for (const use of component.uses) {
    total = addNutrition(total, componentNutrition(use.componentId, components, foods), use.servings);
  }
  return total;
}

/** A meal with each part at the given servings (default one). */
export const mealNutrition = (meal: Meal, servings: Partial<Record<ComponentId, number>> = {}): Nutrition =>
  meal.parts.reduce((total, id) => addNutrition(total, componentNutrition(id), servings[id] ?? 1), ZERO);
