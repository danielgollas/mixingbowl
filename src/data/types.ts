export type FoodId = string;
export type RecipeId = string;

export interface Food {
  id: FoodId;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
}

/** A food in a recipe. `amount` is display text; `grams` drives the math (0 = "to taste"). */
export interface Ingredient {
  foodId: FoodId;
  grams: number;
  amount: string;
}

/** A sub-recipe used inside another recipe. */
export interface Component {
  recipeId: RecipeId;
  servings: number;
}

export type Method = 'air-fryer' | 'stovetop' | 'blender' | 'oven' | 'no-cook';
export type RecipeKind = 'master' | 'meal' | 'sauce';

export interface Recipe {
  id: RecipeId;
  name: string;
  kind: RecipeKind;
  source: 'brief' | 'derived';
  methods: Method[];
  ingredients: Ingredient[];
  components: Component[];
  steps: string[];
  /** Sauces only: the kcal figure the brief states. */
  briefKcal?: number;
}

export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type Slot = (typeof SLOTS)[number];
export type Pattern = 'A' | 'B';
export type Plan = Record<Pattern, Record<Slot, RecipeId>>;

export interface Nutrition {
  kcal: number;
  protein: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  /** Foods this item covers, so tests can check every recipe ingredient is buyable. */
  foods: FoodId[];
}

export interface ShoppingCategory {
  name: string;
  items: ShoppingItem[];
}

export interface AddOn {
  foodId: FoodId;
  stepGrams: number;
  maxSteps: number;
}
