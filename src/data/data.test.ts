import { describe, expect, it } from 'vitest';
import { ADDONS } from './addons';
import { FOOD_LIST, FOODS } from './foods';
import { PLAN } from './plan';
import { RECIPE_LIST, RECIPES } from './recipes';
import { PANTRY_BASICS, SHOPPING } from './shopping';
import { SLOTS } from './types';

const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

describe('data integrity', () => {
  it('has unique food, recipe and shopping ids', () => {
    expect(duplicates(FOOD_LIST.map((f) => f.id))).toEqual([]);
    expect(duplicates(RECIPE_LIST.map((r) => r.id))).toEqual([]);
    expect(duplicates(SHOPPING.flatMap((c) => c.items.map((i) => i.id)))).toEqual([]);
  });

  it('references only existing foods and recipes', () => {
    for (const recipe of RECIPE_LIST) {
      for (const ingredient of recipe.ingredients) {
        expect(FOODS[ingredient.foodId], `${recipe.id} → ${ingredient.foodId}`).toBeDefined();
        expect(ingredient.grams).toBeGreaterThanOrEqual(0);
      }
      for (const component of recipe.components) {
        expect(RECIPES[component.recipeId], `${recipe.id} → ${component.recipeId}`).toBeDefined();
        expect(component.servings).toBeGreaterThan(0);
      }
    }
  });

  it('has no component cycles', () => {
    const visit = (id: string, path: string[]) => {
      expect(path, `cycle: ${[...path, id].join(' → ')}`).not.toContain(id);
      for (const c of RECIPES[id].components) visit(c.recipeId, [...path, id]);
    };
    for (const recipe of RECIPE_LIST) visit(recipe.id, []);
  });

  it('gives every recipe at least one method and step', () => {
    for (const recipe of RECIPE_LIST) {
      expect(recipe.methods.length, recipe.id).toBeGreaterThan(0);
      expect(recipe.steps.length, recipe.id).toBeGreaterThan(0);
    }
  });

  it('includes the 4 master recipes and 8 sauces from the brief', () => {
    const masters = RECIPE_LIST.filter((r) => r.kind === 'master');
    const sauces = RECIPE_LIST.filter((r) => r.kind === 'sauce');
    expect(masters).toHaveLength(4);
    expect(sauces).toHaveLength(8);
    for (const r of [...masters, ...sauces]) expect(r.source, r.id).toBe('brief');
    for (const s of sauces) expect(s.briefKcal, s.id).toBeTypeOf('number');
  });

  it('fills every plan slot with a meal or master recipe', () => {
    for (const pattern of ['A', 'B'] as const) {
      for (const slot of SLOTS) {
        const recipe = RECIPES[PLAN[pattern][slot]];
        expect(recipe, `${pattern}.${slot}`).toBeDefined();
        expect(['master', 'meal']).toContain(recipe.kind);
      }
    }
  });

  it('lists every recipe and top-up food on the shopping list', () => {
    const listed = new Set(SHOPPING.flatMap((c) => c.items.flatMap((i) => i.foods)));
    const used = new Set([
      ...RECIPE_LIST.flatMap((r) => r.ingredients.map((i) => i.foodId)),
      ...ADDONS.map((a) => a.foodId),
    ]);
    const missing = [...used].filter((id) => !listed.has(id) && !PANTRY_BASICS.includes(id));
    expect(missing).toEqual([]);
    for (const id of listed) expect(FOODS[id], `shopping → ${id}`).toBeDefined();
  });

  it('builds top-ups from existing foods', () => {
    for (const addon of ADDONS) {
      expect(FOODS[addon.foodId], addon.foodId).toBeDefined();
      expect(addon.stepGrams).toBeGreaterThan(0);
      expect(addon.maxSteps).toBeGreaterThan(0);
    }
  });
});
