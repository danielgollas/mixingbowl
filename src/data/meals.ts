import { getComponent } from './components';
import type { ComponentId, Meal, MealKind, Role, Slot, WeekMenu } from './types';

const bowl = (
  id: string,
  name: string,
  bed: ComponentId,
  protein: ComponentId,
  veg: ComponentId[],
  sauce: ComponentId | null,
  topping: ComponentId | null,
): Meal => ({
  id,
  name,
  kind: 'bowl',
  parts: [bed, protein, ...veg, ...(sauce ? [sauce] : []), ...(topping ? [topping] : [])],
});

const snack = (id: string, name: string, part: ComponentId): Meal => ({ id, name, kind: 'snack', parts: [part] });

export const PRESET_MEALS: Meal[] = [
  bowl('scramble-bowl', 'Scramble Bowl', 'brown-rice', 'tofu-scramble', ['spinach-mushroom'], 'cheesy-garlic-dressing', 'hemp-hearts'),
  bowl('crispy-tofu-bowl', 'Crispy Tofu Bowl', 'brown-rice', 'crispy-tofu', ['smashed-cucumber', 'crunchy-slaw'], 'spicy-mayo', 'sesame-seeds'),
  bowl('bbq-cabbage-bowl', 'Charred Cabbage BBQ Bowl', 'cauliflower-rice', 'crispy-tofu', ['charred-cabbage'], 'maple-bbq', 'pumpkin-seeds'),
  bowl('shirataki-glaze-bowl', 'Shirataki Glaze Bowl', 'shirataki', 'crispy-tofu', ['bamboo-shoots', 'roasted-broccoli'], 'garlic-soy-glaze', 'sesame-seeds'),
  bowl('buffalo-tempeh-bowl', 'Buffalo Tempeh Bowl', 'lentils-rice', 'tempeh', ['popcorn-cauliflower', 'mixed-greens'], 'buffalo-sauce', 'crispy-shallots'),
  bowl('soy-curl-fajita-bowl', 'Soy Curl Fajita Bowl', 'quinoa', 'soy-curls', ['peppers-onions', 'mixed-greens'], 'lemon-herb-tahini', 'pumpkin-seeds'),
  bowl('seitan-soba-bowl', 'Seitan Soba Bowl', 'soba', 'seitan', ['roasted-broccoli', 'smashed-cucumber'], 'sesame-free-glaze', 'nori'),
  bowl('chickn-greek-bowl', "Greek Chick'n Bowl", 'quinoa-lentils', 'chickn-strips', ['smashed-cucumber', 'mixed-greens'], 'lemon-herb-tahini', 'hemp-hearts'),
  bowl('yuba-noodle-bowl', 'Yuba Noodle Bowl', 'rice-noodles', 'yuba', ['spinach-mushroom', 'bamboo-shoots'], 'garlic-soy-glaze', 'chili-crisp'),
  bowl('crumble-taco-bowl', 'Crumble Taco Bowl', 'brown-rice', 'plant-crumbles', ['crunchy-slaw', 'peppers-onions'], 'spicy-mayo', 'pumpkin-seeds'),
  snack('protein-fluff', 'Protein Fluff', 'protein-fluff'),
  snack('veggie-batons', 'Veggie Batons & Dill Dip', 'veggie-batons'),
  snack('edamame-cup', 'Edamame Cup', 'edamame-cup'),
  snack('berry-smoothie', 'Silken Berry Smoothie', 'berry-smoothie'),
  snack('cabbage-chips', 'Charred Cabbage Chips', 'cabbage-chips'),
];

export const PRESETS: Record<string, Meal> = Object.fromEntries(PRESET_MEALS.map((m) => [m.id, m]));

export const getPreset = (id: string): Meal | undefined => (Object.hasOwn(PRESETS, id) ? PRESETS[id] : undefined);

export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

/** Which kind of meal fills each slot. */
export const SLOT_KIND: Record<Slot, MealKind> = {
  breakfast: 'snack',
  lunch: 'bowl',
  snack: 'snack',
  dinner: 'bowl',
};

export const DEFAULT_MEALS: Slot[] = ['snack', 'dinner'];

export const DEFAULT_MENU: Required<WeekMenu> = {
  breakfast: [
    { mealId: 'berry-smoothie', days: 4 },
    { mealId: 'protein-fluff', days: 3 },
  ],
  lunch: [
    { mealId: 'crispy-tofu-bowl', days: 4 },
    { mealId: 'shirataki-glaze-bowl', days: 3 },
  ],
  snack: [
    { mealId: 'protein-fluff', days: 4 },
    { mealId: 'veggie-batons', days: 3 },
  ],
  dinner: [
    { mealId: 'scramble-bowl', days: 4 },
    { mealId: 'crispy-tofu-bowl', days: 3 },
  ],
};

/** How many parts of each role a bowl may have. */
export const BOWL_ROLES: Partial<Record<Role, { min: number; max: number }>> = {
  bed: { min: 1, max: 1 },
  protein: { min: 1, max: 1 },
  veg: { min: 0, max: Infinity },
  sauce: { min: 0, max: 1 },
  topping: { min: 0, max: 1 },
};

/** The parts of a meal with the given role, in order. */
export const partsWithRole = (meal: Meal, role: Role): ComponentId[] =>
  meal.parts.filter((id) => getComponent(id)?.role === role);

export function isValidMeal(meal: Meal): boolean {
  if (typeof meal.name !== 'string' || meal.name.trim() === '') return false;
  if (new Set(meal.parts).size !== meal.parts.length) return false;
  const roles = meal.parts.map((id) => getComponent(id)?.role);
  if (meal.kind === 'snack') return roles.length > 0 && roles.every((role) => role === 'snack');
  if (roles.some((role) => role === undefined || !BOWL_ROLES[role])) return false;
  return Object.entries(BOWL_ROLES).every(([role, { min, max }]) => {
    const count = roles.filter((r) => r === role).length;
    return count >= min && count <= max;
  });
}
