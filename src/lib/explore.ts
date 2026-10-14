import { COMPONENT_LIST, getComponent } from '../data/components';
import { FOODS } from '../data/foods';
import { PRESET_MEALS } from '../data/meals';
import type { ComponentId, Nutrition, Role } from '../data/types';
import { hrefFor } from '../router';
import type { CustomMeals } from './menu';
import { componentNutrition, mealNutrition } from './nutrition';

export interface RecipeItem {
  kind: 'bowl' | 'snack' | 'part';
  id: string;
  name: string;
  /** Parts only. */
  role: Role | null;
  nutrition: Nutrition;
  href: string;
  /** Lower-case names of the item, its parts and every ingredient, for search. */
  search: string;
}

export type RecipeFilter = 'all' | 'bowls' | 'snacks' | Exclude<Role, 'snack'>;
export type RecipeSort = 'name' | 'protein' | 'kcal' | 'density';

/** The component's name and its ingredients' names, through parts made of other parts. */
function searchTerms(id: ComponentId): string[] {
  const component = getComponent(id);
  if (!component) return [];
  return [
    component.name,
    ...component.ingredients.map((i) => FOODS[i.foodId]?.name ?? ''),
    ...component.uses.flatMap((u) => searchTerms(u.componentId)),
  ];
}

/** Every bowl and snack (presets and your own) and every bowl part. Snack parts are reached through their snacks. */
export function recipeItems(customMeals: CustomMeals): RecipeItem[] {
  const meals = [...PRESET_MEALS, ...Object.values(customMeals)].map(
    (meal): RecipeItem => ({
      kind: meal.kind,
      id: meal.id,
      name: meal.name,
      role: null,
      nutrition: mealNutrition(meal),
      href: hrefFor({ name: 'bowl', id: meal.id }),
      search: [meal.name, ...meal.parts.flatMap(searchTerms)].join(' ').toLowerCase(),
    }),
  );
  const parts = COMPONENT_LIST.filter((c) => c.role !== 'snack').map(
    (c): RecipeItem => ({
      kind: 'part',
      id: c.id,
      name: c.name,
      role: c.role,
      nutrition: componentNutrition(c.id),
      href: hrefFor({ name: 'component', id: c.id }),
      search: searchTerms(c.id).join(' ').toLowerCase(),
    }),
  );
  return [...meals, ...parts];
}

const matchesFilter = (item: RecipeItem, filter: RecipeFilter) =>
  filter === 'all' ||
  (filter === 'bowls' && item.kind === 'bowl') ||
  (filter === 'snacks' && item.kind === 'snack') ||
  item.role === filter;

/** Items matching the filter whose names or ingredients contain every word of the query. */
export function filterItems(items: RecipeItem[], query: string, filter: RecipeFilter): RecipeItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => matchesFilter(item, filter) && words.every((w) => item.search.includes(w)));
}

const density = (n: Nutrition) => n.protein / Math.max(1, n.kcal);

const COMPARE: Record<RecipeSort, (a: RecipeItem, b: RecipeItem) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  protein: (a, b) => b.nutrition.protein - a.nutrition.protein,
  kcal: (a, b) => a.nutrition.kcal - b.nutrition.kcal,
  density: (a, b) => density(b.nutrition) - density(a.nutrition),
};

export const sortItems = (items: RecipeItem[], sort: RecipeSort): RecipeItem[] => [...items].sort(COMPARE[sort]);
