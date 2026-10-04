import { COMPONENTS } from '../data/components';
import { FOODS } from '../data/foods';
import {
  FOOD_CATEGORIES,
  ROLES,
  type ComponentId,
  type FoodCategory,
  type FoodId,
  type Portion,
  type Role,
  type Slot,
  type WeekMenu,
} from '../data/types';
import { formatDecimal, formatNumber, formatQuantity, formatWeight } from './format';
import { resolveMenu, plannedMeals, type CustomMeals, type Menus } from './menu';
import { scaleDay, type ScaledDay } from './scaling';
import type { AppData } from './storage';
import { proteinTarget } from './targets';

export interface PlanInput {
  meals: readonly Slot[];
  menus: Menus;
  customMeals: CustomMeals;
  proteinMin: number | null;
}

export const planInput = ({ settings, menus, customMeals }: AppData): PlanInput => ({
  meals: settings.meals,
  menus,
  customMeals,
  proteinMin: proteinTarget(settings.targetWeight, settings.unit)?.min ?? null,
});

/** One program day's meals, scaled. */
export function dayPlan(input: PlanInput, week: number, day: number, menu: WeekMenu = resolveMenu(input.menus, week)) {
  return scaleDay(plannedMeals(menu, input.meals, day, input.customMeals), input.proteinMin);
}

/** All seven days of a program week, scaled. */
export function weekPlan(input: PlanInput, week: number): ScaledDay[] {
  const menu = resolveMenu(input.menus, week);
  return Array.from({ length: 7 }, (_, i) => dayPlan(input, week, i + 1, menu));
}

export interface WeekTotals {
  /** Servings of every component, including ones used inside others. */
  components: Map<ComponentId, number>;
  /** Grams of every food referenced (0 for "to taste" foods). */
  foods: Map<FoodId, number>;
  meals: number;
}

export function weekTotals(days: ScaledDay[]): WeekTotals {
  const totals: WeekTotals = { components: new Map(), foods: new Map(), meals: 0 };
  const expand = (id: ComponentId, servings: number) => {
    const component = COMPONENTS[id];
    totals.components.set(id, (totals.components.get(id) ?? 0) + servings);
    for (const ingredient of component.ingredients) {
      totals.foods.set(ingredient.foodId, (totals.foods.get(ingredient.foodId) ?? 0) + ingredient.grams * servings);
    }
    for (const use of component.uses) expand(use.componentId, servings * use.servings);
  };
  for (const day of days) {
    for (const meal of day.meals) {
      totals.meals += 1;
      for (const [part, servings] of Object.entries(meal.servings)) expand(part, servings);
    }
  }
  return totals;
}

/** "225 g tofu", "1½ cups cooked", "¼ head". */
export function formatPortion(portion: Portion, servings: number): string {
  const value = portion.amount * servings;
  if (/^g\b/.test(portion.unit)) return `${formatNumber(value)} ${portion.unit}`;
  return `${formatQuantity(value)} ${value <= 1 ? portion.unit : portion.units}`;
}

export const ROLE_TITLES: Record<Role, string> = {
  bed: 'Beds',
  protein: 'Proteins',
  veg: 'Veg',
  sauce: 'Sauces',
  topping: 'Toppings',
  snack: 'Snacks',
};

export interface PrepLine {
  id: ComponentId;
  name: string;
  amount: string;
  details: string[];
}

export interface PrepGroup {
  role: Role;
  title: string;
  lines: PrepLine[];
}

/** One line per component you actually make (combo beds fold into the beds they're built from). */
export function prepList(totals: WeekTotals): PrepGroup[] {
  return ROLES.map((role) => ({
    role,
    title: ROLE_TITLES[role],
    lines: [...totals.components]
      .map(([id, servings]) => ({ component: COMPONENTS[id], servings }))
      .filter(({ component }) => component.role === role && component.ingredients.length > 0)
      .map(({ component, servings }): PrepLine => {
        const details: string[] = [];
        if (component.dryRatio) {
          details.push(`≈ ${formatQuantity((component.portion.amount * servings) / component.dryRatio)} cups dry`);
        }
        for (const ingredient of component.ingredients) {
          const { pack, name } = FOODS[ingredient.foodId];
          // Skip when the amount is already in packs, e.g. "1¾ heads" of charred cabbage.
          if (!pack || ingredient.grams === 0 || pack.unit === component.portion.unit) continue;
          const uses = (ingredient.grams * servings) / pack.grams;
          const what = name.toLowerCase();
          const count = `${formatDecimal(uses)} ${uses <= 1 ? pack.unit : pack.units}`;
          details.push(what.includes(pack.unit) ? `uses ${count}` : `uses ${count} ${what}`);
        }
        return { id: component.id, name: component.name, amount: formatPortion(component.portion, servings), details };
      }),
  })).filter((group) => group.lines.length > 0);
}

/** Up to 5% over a whole pack still counts as that many packs (3.02 blocks → buy 3). */
export const packsToBuy = (uses: number): number => Math.max(1, Math.ceil(uses - 0.05));

const WEIGHED: FoodCategory[] = ['Proteins', 'Produce', 'Grains & Noodles', 'Nuts & Seeds'];

export interface ShoppingLine {
  id: FoodId;
  name: string;
  amount: string | null;
  note: string | null;
}

export interface ShoppingGroup {
  category: FoodCategory;
  lines: ShoppingLine[];
}

export function shoppingList(totals: WeekTotals): ShoppingGroup[] {
  return FOOD_CATEGORIES.filter((category) => category !== 'Basics')
    .map((category) => ({
      category,
      lines: [...totals.foods]
        .map(([id, grams]) => ({ food: FOODS[id], grams }))
        .filter(({ food }) => food.category === category)
        .sort((a, b) => a.food.name.localeCompare(b.food.name))
        .map(({ food, grams }): ShoppingLine => {
          const line: ShoppingLine = { id: food.id, name: food.name, amount: null, note: null };
          if (grams <= 0) return line;
          if (food.pack) {
            const uses = grams / food.pack.grams;
            const buy = packsToBuy(uses);
            line.amount = `${buy} ${buy === 1 ? food.pack.unit : food.pack.units}`;
            line.note = `uses ${formatDecimal(uses)}`;
          } else if (food.cookedPerDry) {
            line.amount = `≈ ${formatWeight(grams / food.cookedPerDry)} dry`;
          } else if (WEIGHED.includes(food.category)) {
            line.amount = `≈ ${formatWeight(grams)}`;
          }
          return line;
        }),
    }))
    .filter((group) => group.lines.length > 0);
}
