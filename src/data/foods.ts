import type { Food, FoodCategory, FoodId, Pack } from './types';

const pack = (grams: number, unit: string, units = `${unit}s`): Pack => ({ grams, unit, units });

const food = (
  id: FoodId,
  name: string,
  kcalPer100g: number,
  proteinPer100g: number,
  category: FoodCategory,
  extra: Pick<Food, 'pack' | 'cookedPerDry'> = {},
): Food => ({ id, name, kcalPer100g, proteinPer100g, category, ...extra });

/** Approximate per-100 g values from USDA FoodData Central. Estimates, not label data. */
export const FOOD_LIST: Food[] = [
  // ---- Proteins ----
  food('tofu-firm', 'Extra-firm tofu', 144, 17.3, 'Proteins', { pack: pack(397, 'block') }),
  food('tofu-silken', 'Silken tofu', 55, 4.8, 'Proteins', { pack: pack(349, 'pack') }),
  food('tempeh', 'Tempeh', 192, 20.3, 'Proteins', { pack: pack(227, 'pack') }),
  food('seitan', 'Seitan', 130, 21, 'Proteins', { pack: pack(227, 'pack') }),
  food('yuba', 'Yuba (fresh or frozen tofu skin)', 220, 22, 'Proteins', { pack: pack(227, 'pack') }),
  food('soy-curls', 'Soy curls (dry)', 440, 40, 'Proteins', { pack: pack(227, 'bag') }),
  food('chickn-strips', "Plant-based chick'n strips", 160, 18, 'Proteins', { pack: pack(255, 'bag') }),
  food('plant-crumbles', 'Plant-based crumbles', 200, 18, 'Proteins', { pack: pack(340, 'pack') }),
  food('edamame', 'Frozen shelled edamame', 121, 11.9, 'Proteins', { pack: pack(340, 'bag') }),

  // ---- Produce ----
  food('spinach', 'Spinach', 23, 2.9, 'Produce'),
  food('mushrooms', 'Mushrooms', 22, 3.1, 'Produce'),
  food('riced-cauliflower', 'Riced cauliflower', 25, 1.9, 'Produce'),
  food('cauliflower', 'Cauliflower', 25, 1.9, 'Produce', { pack: pack(588, 'head') }),
  food('cabbage', 'Green cabbage', 25, 1.3, 'Produce', { pack: pack(908, 'head') }),
  food('red-cabbage', 'Red cabbage', 31, 1.4, 'Produce', { pack: pack(850, 'head') }),
  food('broccoli', 'Broccoli', 34, 2.8, 'Produce'),
  food('bell-pepper', 'Bell peppers', 26, 1, 'Produce', { pack: pack(150, 'pepper') }),
  food('onion', 'Onions', 40, 1.1, 'Produce', { pack: pack(150, 'onion') }),
  food('carrot', 'Carrots', 41, 0.9, 'Produce'),
  food('mixed-greens', 'Mixed greens', 17, 1.5, 'Produce'),
  food('cucumber', 'Cucumbers', 15, 0.7, 'Produce', { pack: pack(300, 'cucumber') }),
  food('celery', 'Celery', 14, 0.7, 'Produce'),
  food('bamboo-shoots', 'Bamboo shoots', 19, 1.7, 'Produce'),
  food('garlic', 'Fresh garlic', 149, 6.4, 'Produce'),
  food('lemon-juice', 'Lemons or lemon juice', 22, 0.4, 'Produce'),
  food('frozen-berries', 'Frozen strawberries / blueberries', 45, 0.7, 'Produce'),

  // ---- Grains & noodles (beds are entered cooked) ----
  food('brown-rice', 'Brown rice', 112, 2.3, 'Grains & Noodles', { cookedPerDry: 2.7 }),
  food('quinoa', 'Quinoa', 120, 4.4, 'Grains & Noodles', { cookedPerDry: 2.8 }),
  food('lentils', 'Lentils', 116, 9, 'Grains & Noodles', { cookedPerDry: 2.5 }),
  food('soba', 'Soba noodles', 99, 5.1, 'Grains & Noodles', { cookedPerDry: 2.2 }),
  food('rice-noodles', 'Rice noodles', 108, 1.8, 'Grains & Noodles', { cookedPerDry: 2.2 }),
  food('shirataki', 'Shirataki / konjac noodles', 10, 0, 'Grains & Noodles', { pack: pack(200, 'bag') }),

  // ---- Nuts & seeds ----
  food('sesame-seeds', 'Sesame seeds', 573, 17.7, 'Nuts & Seeds'),
  food('pumpkin-seeds', 'Pumpkin seeds', 559, 30, 'Nuts & Seeds'),
  food('hemp-hearts', 'Hemp hearts', 553, 31.6, 'Nuts & Seeds'),

  // ---- Sauces & condiments ----
  food('soy-sauce', 'Low-sodium soy sauce / tamari', 53, 8.1, 'Sauces & Condiments'),
  food('rice-vinegar', 'Rice vinegar', 18, 0, 'Sauces & Condiments'),
  food('apple-cider-vinegar', 'Apple cider vinegar', 22, 0, 'Sauces & Condiments'),
  food('white-vinegar', 'White vinegar', 18, 0, 'Sauces & Condiments'),
  food('sriracha', 'Sriracha', 93, 1.9, 'Sauces & Condiments'),
  food('hot-sauce', "Cayenne hot sauce (Frank's RedHot)", 11, 0.5, 'Sauces & Condiments'),
  food('pickle-juice', 'Pickle juice', 8, 0, 'Sauces & Condiments'),
  food('dill-pickles', 'Dill pickles', 12, 0.5, 'Sauces & Condiments'),
  food('tomato-paste', 'Tomato paste', 82, 4.3, 'Sauces & Condiments'),
  food('liquid-smoke', 'Liquid smoke', 0, 0, 'Sauces & Condiments'),
  food('chili-crisp', 'Chili crisp', 680, 3, 'Sauces & Condiments'),
  food('crispy-shallots', 'Crispy fried shallots', 560, 5, 'Sauces & Condiments'),
  food('nori', 'Nori sheets', 35, 5.8, 'Sauces & Condiments'),
  food('almond-milk', 'Unsweetened almond milk', 15, 0.6, 'Sauces & Condiments'),
  food('olive-oil-spray', 'Olive oil spray', 884, 0, 'Sauces & Condiments'),

  // ---- Spices & baking ----
  food('nutritional-yeast', 'Nutritional yeast', 400, 50, 'Spices & Baking'),
  food('xanthan-gum', 'Xanthan gum', 333, 0, 'Spices & Baking'),
  food('sweetener', 'Stevia or monk fruit', 0, 0, 'Spices & Baking'),
  food('garlic-powder', 'Garlic powder', 331, 16.6, 'Spices & Baking'),
  food('onion-powder', 'Onion powder', 341, 10.4, 'Spices & Baking'),
  food('smoked-paprika', 'Smoked paprika', 282, 14.1, 'Spices & Baking'),
  food('turmeric', 'Turmeric', 312, 9.7, 'Spices & Baking'),
  food('ginger', 'Ground ginger', 335, 9, 'Spices & Baking'),
  food('garlic-salt', 'Garlic salt', 80, 4, 'Spices & Baking'),
  food('dried-herbs', 'Dried dill, oregano & parsley', 270, 15, 'Spices & Baking'),

  // ---- Basics (never on the shopping list) ----
  food('water', 'Water', 0, 0, 'Basics'),
  food('ice', 'Ice', 0, 0, 'Basics'),
  food('salt-pepper', 'Salt & pepper', 0, 0, 'Basics'),
];

export const FOODS: Record<FoodId, Food> = Object.fromEntries(FOOD_LIST.map((f) => [f.id, f]));
