import type { FoodId, ShoppingCategory, ShoppingItem } from './types';

const item = (id: string, name: string, foods: FoodId[] = [id]): ShoppingItem => ({ id, name, foods });

/** Kitchen basics every recipe assumes you have; not listed for shopping. */
export const PANTRY_BASICS: FoodId[] = ['water', 'ice', 'salt-pepper'];

/** Brief section 6, plus items the plan and sauces use that the brief's list leaves out. */
export const SHOPPING: ShoppingCategory[] = [
  {
    name: 'Proteins',
    items: [item('tofu-extra-firm', 'Extra-firm tofu blocks', ['tofu-firm']), item('tofu-silken', 'Silken tofu blocks')],
  },
  {
    name: 'Volume Bases',
    items: [
      item('spinach', 'Bagged spinach'),
      item('mushrooms', 'Sliced mushrooms'),
      item('riced-cauliflower', 'Riced cauliflower (frozen or fresh)'),
      item('cabbage', 'Green cabbage heads'),
      item('cauliflower', 'Cauliflower heads'),
      item('cucumbers', 'Cucumbers', ['cucumber']),
      item('celery', 'Celery'),
      item('bamboo-shoots', 'Bamboo shoots'),
    ],
  },
  {
    name: 'Noodle Sub',
    items: [item('shirataki', 'Shirataki / konjac noodles (canned or wet-packs)')],
  },
  {
    name: 'Pantry & Condiments',
    items: [
      item('soy-sauce', 'Low-sodium soy sauce / tamari'),
      item('rice-vinegar', 'Rice vinegar'),
      item('apple-cider-vinegar', 'Apple cider vinegar'),
      item('hot-sauce', "Cayenne hot sauce (Frank's RedHot)"),
      item('pickles', 'Pickle juice & whole pickles', ['pickle-juice', 'dill-pickles']),
      item('tomato-paste', 'Tomato paste'),
      item('liquid-smoke', 'Liquid smoke'),
    ],
  },
  {
    name: 'Spices & Thickening Agents',
    items: [
      item('xanthan-gum', 'Xanthan gum (critical for fluff and sauce thickening)'),
      item('nutritional-yeast', 'Nutritional yeast (cheesy volume agent)'),
      item('sweetener', 'Stevia or monk fruit (granular and drops)'),
      item('turmeric', 'Turmeric'),
      item('garlic-powder', 'Garlic powder'),
      item('onion-powder', 'Onion powder'),
      item('smoked-paprika', 'Smoked paprika'),
      item('garlic-salt', 'Garlic salt'),
    ],
  },
  {
    name: 'Also Used in the Plan',
    items: [
      item('frozen-berries', 'Frozen strawberries / blueberries'),
      item('almond-milk', 'Unsweetened almond milk'),
      item('mixed-greens', 'Mixed greens'),
      item('olive-oil-spray', 'Olive oil spray'),
      item('garlic', 'Fresh garlic'),
      item('ginger', 'Ground ginger'),
      item('dried-dill', 'Dried dill', ['dried-herbs']),
    ],
  },
  {
    name: 'Extra Sauce Ingredients',
    items: [
      item('sriracha', 'Sriracha'),
      item('lemons', 'Lemons or lemon juice', ['lemon-juice']),
      item('white-vinegar', 'White vinegar'),
      item('dried-oregano-parsley', 'Dried oregano & parsley', ['dried-herbs']),
    ],
  },
  {
    name: 'Optional Top-ups',
    items: [item('seitan', 'Seitan'), item('tempeh', 'Tempeh'), item('edamame', 'Frozen shelled edamame')],
  },
];
