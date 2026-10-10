import type { Food, FoodCategory, FoodId, Pack } from './types';

const pack = (grams: number, unit: string, units = `${unit}s`): Pack => ({ grams, unit, units });

interface Extra {
  fat: number;
  fiber: number;
  sugar: number;
}

const food = (
  id: FoodId,
  name: string,
  kcalPer100g: number,
  proteinPer100g: number,
  { fat, fiber, sugar }: Extra,
  category: FoodCategory,
  extra: Pick<Food, 'pack' | 'cookedPerDry'> = {},
): Food => ({
  id,
  name,
  kcalPer100g,
  proteinPer100g,
  fatPer100g: fat,
  fiberPer100g: fiber,
  sugarPer100g: sugar,
  category,
  ...extra,
});

/** Approximate per-100 g values from USDA FoodData Central. Estimates, not label data. */
export const FOOD_LIST: Food[] = [
  // ---- Proteins ----
  food('tofu-firm', 'Extra-firm tofu', 144, 17.3, { fat: 8.7, fiber: 2.3, sugar: 0.6 }, 'Proteins', { pack: pack(397, 'block') }),
  food('tofu-silken', 'Silken tofu', 55, 4.8, { fat: 2.7, fiber: 0.1, sugar: 1.3 }, 'Proteins', { pack: pack(349, 'pack') }),
  food('tempeh', 'Tempeh', 192, 20.3, { fat: 10.8, fiber: 5, sugar: 0 }, 'Proteins', { pack: pack(227, 'pack') }),
  food('seitan', 'Seitan', 130, 21, { fat: 1.9, fiber: 0.6, sugar: 0 }, 'Proteins', { pack: pack(227, 'pack') }),
  food('yuba', 'Yuba (fresh or frozen tofu skin)', 220, 22, { fat: 12, fiber: 1, sugar: 0.5 }, 'Proteins', { pack: pack(227, 'pack') }),
  food('soy-curls', 'Soy curls (dry)', 440, 40, { fat: 20, fiber: 13, sugar: 7 }, 'Proteins', { pack: pack(227, 'bag') }),
  food('chickn-strips', "Plant-based chick'n strips", 160, 18, { fat: 8, fiber: 3, sugar: 1 }, 'Proteins', { pack: pack(255, 'bag') }),
  food('plant-crumbles', 'Plant-based crumbles', 200, 18, { fat: 12, fiber: 3, sugar: 0.5 }, 'Proteins', { pack: pack(340, 'pack') }),
  food('edamame', 'Frozen shelled edamame', 121, 11.9, { fat: 5.2, fiber: 5.2, sugar: 2.2 }, 'Proteins', { pack: pack(340, 'bag') }),

  // ---- Produce ----
  food('spinach', 'Spinach', 23, 2.9, { fat: 0.4, fiber: 2.2, sugar: 0.4 }, 'Produce'),
  food('mushrooms', 'Mushrooms', 22, 3.1, { fat: 0.3, fiber: 1, sugar: 2 }, 'Produce'),
  food('riced-cauliflower', 'Riced cauliflower', 25, 1.9, { fat: 0.3, fiber: 2, sugar: 1.9 }, 'Produce'),
  food('cauliflower', 'Cauliflower', 25, 1.9, { fat: 0.3, fiber: 2, sugar: 1.9 }, 'Produce', { pack: pack(588, 'head') }),
  food('cabbage', 'Green cabbage', 25, 1.3, { fat: 0.1, fiber: 2.5, sugar: 3.2 }, 'Produce', { pack: pack(908, 'head') }),
  food('red-cabbage', 'Red cabbage', 31, 1.4, { fat: 0.2, fiber: 2.1, sugar: 3.8 }, 'Produce', { pack: pack(850, 'head') }),
  food('broccoli', 'Broccoli', 34, 2.8, { fat: 0.4, fiber: 2.6, sugar: 1.7 }, 'Produce'),
  food('bell-pepper', 'Bell peppers', 26, 1, { fat: 0.3, fiber: 2.1, sugar: 4.2 }, 'Produce', { pack: pack(150, 'pepper') }),
  food('onion', 'Onions', 40, 1.1, { fat: 0.1, fiber: 1.7, sugar: 4.2 }, 'Produce', { pack: pack(150, 'onion') }),
  food('carrot', 'Carrots', 41, 0.9, { fat: 0.2, fiber: 2.8, sugar: 4.7 }, 'Produce'),
  food('mixed-greens', 'Mixed greens', 17, 1.5, { fat: 0.3, fiber: 2, sugar: 0.8 }, 'Produce'),
  food('cucumber', 'Cucumbers', 15, 0.7, { fat: 0.1, fiber: 0.5, sugar: 1.7 }, 'Produce', { pack: pack(300, 'cucumber') }),
  food('celery', 'Celery', 14, 0.7, { fat: 0.2, fiber: 1.6, sugar: 1.3 }, 'Produce'),
  food('bamboo-shoots', 'Bamboo shoots', 19, 1.7, { fat: 0.4, fiber: 1.4, sugar: 1.7 }, 'Produce'),
  food('garlic', 'Fresh garlic', 149, 6.4, { fat: 0.5, fiber: 2.1, sugar: 1 }, 'Produce'),
  food('lemon-juice', 'Lemons or lemon juice', 22, 0.4, { fat: 0.2, fiber: 0.3, sugar: 2.5 }, 'Produce'),
  food('frozen-berries', 'Frozen strawberries / blueberries', 45, 0.7, { fat: 0.3, fiber: 2.2, sugar: 6.5 }, 'Produce'),

  // ---- Grains & noodles (beds are entered cooked) ----
  food('brown-rice', 'Brown rice', 112, 2.3, { fat: 0.9, fiber: 1.8, sugar: 0.4 }, 'Grains & Noodles', { cookedPerDry: 2.7 }),
  food('quinoa', 'Quinoa', 120, 4.4, { fat: 1.9, fiber: 2.8, sugar: 0.9 }, 'Grains & Noodles', { cookedPerDry: 2.8 }),
  food('lentils', 'Lentils', 116, 9, { fat: 0.4, fiber: 7.9, sugar: 1.8 }, 'Grains & Noodles', { cookedPerDry: 2.5 }),
  food('soba', 'Soba noodles', 99, 5.1, { fat: 0.1, fiber: 1, sugar: 0 }, 'Grains & Noodles', { cookedPerDry: 2.2 }),
  food('rice-noodles', 'Rice noodles', 108, 1.8, { fat: 0.2, fiber: 1, sugar: 0 }, 'Grains & Noodles', { cookedPerDry: 2.2 }),
  food('shirataki', 'Shirataki / konjac noodles', 10, 0, { fat: 0, fiber: 3, sugar: 0 }, 'Grains & Noodles', { pack: pack(200, 'bag') }),

  // ---- Nuts & seeds ----
  food('sesame-seeds', 'Sesame seeds', 573, 17.7, { fat: 49.7, fiber: 11.8, sugar: 0.3 }, 'Nuts & Seeds'),
  food('pumpkin-seeds', 'Pumpkin seeds', 559, 30, { fat: 49, fiber: 6, sugar: 1.4 }, 'Nuts & Seeds'),
  food('hemp-hearts', 'Hemp hearts', 553, 31.6, { fat: 48.8, fiber: 4, sugar: 1.5 }, 'Nuts & Seeds'),

  // ---- Sauces & condiments ----
  food('soy-sauce', 'Low-sodium soy sauce / tamari', 53, 8.1, { fat: 0.1, fiber: 0.8, sugar: 0.4 }, 'Sauces & Condiments'),
  food('rice-vinegar', 'Rice vinegar', 18, 0, { fat: 0, fiber: 0, sugar: 0 }, 'Sauces & Condiments'),
  food('apple-cider-vinegar', 'Apple cider vinegar', 22, 0, { fat: 0, fiber: 0, sugar: 0.4 }, 'Sauces & Condiments'),
  food('white-vinegar', 'White vinegar', 18, 0, { fat: 0, fiber: 0, sugar: 0 }, 'Sauces & Condiments'),
  food('sriracha', 'Sriracha', 93, 1.9, { fat: 0.9, fiber: 2.2, sugar: 15 }, 'Sauces & Condiments'),
  food('hot-sauce', "Cayenne hot sauce (Frank's RedHot)", 11, 0.5, { fat: 0.4, fiber: 0.3, sugar: 0 }, 'Sauces & Condiments'),
  food('pickle-juice', 'Pickle juice', 8, 0, { fat: 0, fiber: 0, sugar: 0.4 }, 'Sauces & Condiments'),
  food('dill-pickles', 'Dill pickles', 12, 0.5, { fat: 0.2, fiber: 1, sugar: 1.3 }, 'Sauces & Condiments'),
  food('tomato-paste', 'Tomato paste', 82, 4.3, { fat: 0.5, fiber: 4.1, sugar: 12.2 }, 'Sauces & Condiments'),
  food('liquid-smoke', 'Liquid smoke', 0, 0, { fat: 0, fiber: 0, sugar: 0 }, 'Sauces & Condiments'),
  food('chili-crisp', 'Chili crisp', 680, 3, { fat: 72, fiber: 2, sugar: 3 }, 'Sauces & Condiments'),
  food('crispy-shallots', 'Crispy fried shallots', 560, 5, { fat: 40, fiber: 4, sugar: 8 }, 'Sauces & Condiments'),
  food('nori', 'Nori sheets', 35, 5.8, { fat: 0.3, fiber: 0.3, sugar: 0.5 }, 'Sauces & Condiments'),
  food('almond-milk', 'Unsweetened almond milk', 15, 0.6, { fat: 1.1, fiber: 0.2, sugar: 0 }, 'Sauces & Condiments'),
  food('olive-oil-spray', 'Olive oil spray', 884, 0, { fat: 100, fiber: 0, sugar: 0 }, 'Sauces & Condiments'),

  // ---- Spices & baking ----
  food('nutritional-yeast', 'Nutritional yeast', 400, 50, { fat: 5, fiber: 20, sugar: 0 }, 'Spices & Baking'),
  food('xanthan-gum', 'Xanthan gum', 333, 0, { fat: 0, fiber: 77, sugar: 0 }, 'Spices & Baking'),
  food('sweetener', 'Stevia or monk fruit', 0, 0, { fat: 0, fiber: 0, sugar: 0 }, 'Spices & Baking'),
  food('garlic-powder', 'Garlic powder', 331, 16.6, { fat: 0.7, fiber: 9, sugar: 2.4 }, 'Spices & Baking'),
  food('onion-powder', 'Onion powder', 341, 10.4, { fat: 1, fiber: 15, sugar: 6.6 }, 'Spices & Baking'),
  food('smoked-paprika', 'Smoked paprika', 282, 14.1, { fat: 13, fiber: 35, sugar: 10 }, 'Spices & Baking'),
  food('turmeric', 'Turmeric', 312, 9.7, { fat: 3.3, fiber: 22.7, sugar: 3.2 }, 'Spices & Baking'),
  food('ginger', 'Ground ginger', 335, 9, { fat: 4.2, fiber: 14, sugar: 3.4 }, 'Spices & Baking'),
  food('garlic-salt', 'Garlic salt', 80, 4, { fat: 0.2, fiber: 2, sugar: 0.5 }, 'Spices & Baking'),
  food('dried-herbs', 'Dried dill, oregano & parsley', 270, 15, { fat: 4, fiber: 30, sugar: 2 }, 'Spices & Baking'),

  // ---- Basics (never on the shopping list) ----
  food('water', 'Water', 0, 0, { fat: 0, fiber: 0, sugar: 0 }, 'Basics'),
  food('ice', 'Ice', 0, 0, { fat: 0, fiber: 0, sugar: 0 }, 'Basics'),
  food('salt-pepper', 'Salt & pepper', 0, 0, { fat: 0, fiber: 0, sugar: 0 }, 'Basics'),
];

export const FOODS: Record<FoodId, Food> = Object.fromEntries(FOOD_LIST.map((f) => [f.id, f]));
