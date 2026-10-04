import { describe, expect, it } from 'vitest';
import { COMPONENT_LIST, COMPONENTS, getComponent } from './components';
import { FOOD_LIST, FOODS } from './foods';
import { DEFAULT_MEALS, DEFAULT_MENU, PRESET_MEALS, SLOT_KIND, getPreset, isValidMeal } from './meals';
import { SLOTS, type Meal } from './types';

const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

describe('foods and components', () => {
  it('has unique ids', () => {
    expect(duplicates(FOOD_LIST.map((f) => f.id))).toEqual([]);
    expect(duplicates(COMPONENT_LIST.map((c) => c.id))).toEqual([]);
    expect(duplicates(PRESET_MEALS.map((m) => m.id))).toEqual([]);
  });

  it('references only existing foods and components', () => {
    for (const component of COMPONENT_LIST) {
      for (const ingredient of component.ingredients) {
        expect(FOODS[ingredient.foodId], `${component.id} → ${ingredient.foodId}`).toBeDefined();
        expect(ingredient.grams).toBeGreaterThanOrEqual(0);
      }
      for (const use of component.uses) {
        expect(COMPONENTS[use.componentId], `${component.id} → ${use.componentId}`).toBeDefined();
        expect(use.servings).toBeGreaterThan(0);
      }
    }
  });

  it('has no cycles in components that use other components', () => {
    const visit = (id: string, path: string[]) => {
      expect(path, `cycle: ${[...path, id].join(' → ')}`).not.toContain(id);
      for (const use of COMPONENTS[id].uses) visit(use.componentId, [...path, id]);
    };
    for (const component of COMPONENT_LIST) visit(component.id, []);
  });

  it('gives every component a portion, a method and steps', () => {
    for (const component of COMPONENT_LIST) {
      expect(component.portion.amount, component.id).toBeGreaterThan(0);
      expect(component.methods.length, component.id).toBeGreaterThan(0);
      expect(component.steps.length, component.id).toBeGreaterThan(0);
      expect(component.ingredients.length + component.uses.length, component.id).toBeGreaterThan(0);
    }
  });

  it('builds combo beds from the single beds, so prep shares one line per bed', () => {
    expect(COMPONENTS['lentils-rice'].uses.map((u) => u.componentId)).toEqual(['brown-rice', 'lentils']);
    expect(COMPONENTS['quinoa-lentils'].uses.map((u) => u.componentId)).toEqual(['quinoa', 'lentils']);
  });

  it('includes the 8 sauces from the brief', () => {
    const sauces = COMPONENT_LIST.filter((c) => c.role === 'sauce');
    expect(sauces).toHaveLength(8);
    for (const sauce of sauces) {
      expect(sauce.source, sauce.id).toBe('brief');
      expect(sauce.briefKcal, sauce.id).toBeTypeOf('number');
    }
  });

  it('has options for every bowl slot', () => {
    for (const role of ['bed', 'protein', 'veg', 'sauce', 'topping', 'snack'] as const) {
      expect(COMPONENT_LIST.filter((c) => c.role === role).length, role).toBeGreaterThanOrEqual(5);
    }
  });

  it('does not match inherited object keys as ids', () => {
    expect(getComponent('constructor')).toBeUndefined();
    expect(getPreset('toString')).toBeUndefined();
  });
});

describe('meals', () => {
  it('has ten valid preset bowls and five valid snacks', () => {
    expect(PRESET_MEALS.filter((m) => m.kind === 'bowl')).toHaveLength(10);
    expect(PRESET_MEALS.filter((m) => m.kind === 'snack')).toHaveLength(5);
    for (const meal of PRESET_MEALS) expect(isValidMeal(meal), meal.id).toBe(true);
  });

  it('reuses components across preset bowls', () => {
    const uses = (id: string) => PRESET_MEALS.filter((m) => m.parts.includes(id)).length;
    expect(uses('brown-rice')).toBeGreaterThanOrEqual(3);
    expect(uses('crispy-tofu')).toBeGreaterThanOrEqual(3);
  });

  it('fills the default menu with seven days of the right kind for every meal', () => {
    for (const slot of SLOTS) {
      const entries = DEFAULT_MENU[slot];
      expect(entries.reduce((sum, e) => sum + e.days, 0), slot).toBe(7);
      for (const entry of entries) expect(getPreset(entry.mealId)?.kind, `${slot} → ${entry.mealId}`).toBe(SLOT_KIND[slot]);
    }
    expect(DEFAULT_MEALS).toEqual(['snack', 'dinner']);
  });

  describe('isValidMeal', () => {
    const bowl = (parts: string[], name = 'Mine'): Meal => ({ id: 'x', name, kind: 'bowl', parts });

    it('accepts any number of veg, and no sauce or topping', () => {
      expect(isValidMeal(bowl(['quinoa', 'seitan']))).toBe(true);
      expect(isValidMeal(bowl(['quinoa', 'seitan', 'roasted-broccoli', 'mixed-greens', 'crunchy-slaw', 'nori']))).toBe(true);
    });

    it('needs exactly one bed and one protein', () => {
      expect(isValidMeal(bowl(['seitan', 'mixed-greens']))).toBe(false);
      expect(isValidMeal(bowl(['quinoa', 'brown-rice', 'seitan']))).toBe(false);
      expect(isValidMeal(bowl(['quinoa', 'seitan', 'tempeh']))).toBe(false);
    });

    it('allows at most one sauce and one topping', () => {
      expect(isValidMeal(bowl(['quinoa', 'seitan', 'spicy-mayo', 'maple-bbq']))).toBe(false);
      expect(isValidMeal(bowl(['quinoa', 'seitan', 'nori', 'chili-crisp']))).toBe(false);
    });

    it('rejects snacks, unknown parts, duplicates and blank names', () => {
      expect(isValidMeal(bowl(['quinoa', 'seitan', 'protein-fluff']))).toBe(false);
      expect(isValidMeal(bowl(['quinoa', 'seitan', 'unobtainium']))).toBe(false);
      expect(isValidMeal(bowl(['quinoa', 'seitan', 'nori', 'nori']))).toBe(false);
      expect(isValidMeal(bowl(['quinoa', 'seitan'], '  '))).toBe(false);
    });
  });
});
