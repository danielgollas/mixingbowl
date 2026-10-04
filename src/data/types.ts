export type FoodId = string;
export type ComponentId = string;
export type MealId = string;

export const FOOD_CATEGORIES = [
  'Proteins',
  'Produce',
  'Grains & Noodles',
  'Nuts & Seeds',
  'Sauces & Condiments',
  'Spices & Baking',
  'Basics',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/** How a food is sold, e.g. a 397 g block of tofu. */
export interface Pack {
  grams: number;
  unit: string;
  units: string;
}

export interface Food {
  id: FoodId;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  category: FoodCategory;
  pack?: Pack;
  /** Grams of cooked food per gram dry, for foods entered cooked but bought dry. */
  cookedPerDry?: number;
}

/** A food in a component. `amount` is display text; `grams` drives the math (0 = "to taste"). */
export interface Ingredient {
  foodId: FoodId;
  grams: number;
  amount: string;
}

/** Another component used inside this one. */
export interface Use {
  componentId: ComponentId;
  servings: number;
}

export const ROLES = ['bed', 'protein', 'veg', 'sauce', 'topping', 'snack'] as const;
export type Role = (typeof ROLES)[number];

export interface Portion {
  amount: number;
  unit: string;
  units: string;
}

export type Method = 'air-fryer' | 'stovetop' | 'blender' | 'oven' | 'no-cook';

/** A batch-preppable building block. All quantities are for one portion. */
export interface Component {
  id: ComponentId;
  name: string;
  role: Role;
  portion: Portion;
  ingredients: Ingredient[];
  uses: Use[];
  methods: Method[];
  steps: string[];
  source: 'brief' | 'derived';
  /** Sauces only: the kcal figure the brief states. */
  briefKcal?: number;
  /** Beds only: cooked cups per dry cup. */
  dryRatio?: number;
}

export type MealKind = 'bowl' | 'snack';

export interface Meal {
  id: MealId;
  name: string;
  kind: MealKind;
  parts: ComponentId[];
}

export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type Slot = (typeof SLOTS)[number];

export interface MenuEntry {
  mealId: MealId;
  days: number;
}

export type WeekMenu = Partial<Record<Slot, MenuEntry[]>>;

export interface Nutrition {
  kcal: number;
  protein: number;
}
