import { FOODS } from '../data/foods';
import { PLAN } from '../data/plan';
import { RECIPES } from '../data/recipes';
import { SLOTS, type Food, type FoodId, type Nutrition, type Pattern, type Recipe, type RecipeId, type Slot } from '../data/types';

export const ZERO: Nutrition = { kcal: 0, protein: 0 };

export const addNutrition = (a: Nutrition, b: Nutrition, times = 1): Nutrition => ({
  kcal: a.kcal + b.kcal * times,
  protein: a.protein + b.protein * times,
});

export function foodNutrition(foodId: FoodId, grams: number, foods: Record<FoodId, Food> = FOODS): Nutrition {
  const food = Object.hasOwn(foods, foodId) ? foods[foodId] : undefined;
  if (!food) throw new Error(`Unknown food: ${foodId}`);
  return { kcal: (food.kcalPer100g * grams) / 100, protein: (food.proteinPer100g * grams) / 100 };
}

export function recipeNutrition(
  recipeId: RecipeId,
  recipes: Record<RecipeId, Recipe> = RECIPES,
  foods: Record<FoodId, Food> = FOODS,
): Nutrition {
  const recipe = Object.hasOwn(recipes, recipeId) ? recipes[recipeId] : undefined;
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
  let total = ZERO;
  for (const ingredient of recipe.ingredients) {
    total = addNutrition(total, foodNutrition(ingredient.foodId, ingredient.grams, foods));
  }
  for (const component of recipe.components) {
    total = addNutrition(total, recipeNutrition(component.recipeId, recipes, foods), component.servings);
  }
  return total;
}

export const slotsTotals = (pattern: Pattern, slots: readonly Slot[]): Nutrition =>
  slots.reduce((total, slot) => addNutrition(total, recipeNutrition(PLAN[pattern][slot])), ZERO);

export const patternTotals = (pattern: Pattern): Nutrition => slotsTotals(pattern, SLOTS);
