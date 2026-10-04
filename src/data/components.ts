import type { Component, ComponentId, FoodId, Ingredient, Method, Portion, Role, Use } from './types';

const ing = (foodId: FoodId, grams: number, amount: string): Ingredient => ({ foodId, grams, amount });
const use = (componentId: ComponentId, servings = 1): Use => ({ componentId, servings });
const portion = (amount: number, unit: string, units = unit): Portion => ({ amount, unit, units });

interface Spec {
  id: ComponentId;
  name: string;
  portion: Portion;
  ingredients?: Ingredient[];
  uses?: Use[];
  methods: Method[];
  steps: string[];
  source?: 'brief' | 'derived';
  briefKcal?: number;
  dryRatio?: number;
}

const make =
  (role: Role) =>
  ({ ingredients = [], uses = [], source = 'derived', ...spec }: Spec): Component => ({
    ...spec,
    role,
    ingredients,
    uses,
    source,
  });

const bed = make('bed');
const protein = make('protein');
const veg = make('veg');
const sauce = make('sauce');
const topping = make('topping');
const snack = make('snack');

const SERVING = portion(1, 'serving', 'servings');

export const COMPONENT_LIST: Component[] = [
  // ---- Beds ----
  bed({
    id: 'brown-rice',
    name: 'Brown rice',
    portion: portion(1, 'cup cooked', 'cups cooked'),
    ingredients: [ing('brown-rice', 195, '1 cup cooked brown rice')],
    methods: ['stovetop'],
    dryRatio: 3,
    steps: [
      'Rinse the rice, then simmer 1 part rice to 2 parts water, covered, for 40–45 minutes.',
      'Rest 10 minutes off the heat, fluff and cool quickly. Keeps 5 days in the fridge or 3 months frozen in portions.',
    ],
  }),
  bed({
    id: 'quinoa',
    name: 'Quinoa',
    portion: portion(1, 'cup cooked', 'cups cooked'),
    ingredients: [ing('quinoa', 185, '1 cup cooked quinoa')],
    methods: ['stovetop'],
    dryRatio: 3,
    steps: [
      'Rinse well, then simmer 1 part quinoa to 2 parts water, covered, for 15 minutes.',
      'Rest 5 minutes and fluff. Keeps 5 days in the fridge.',
    ],
  }),
  bed({
    id: 'lentils',
    name: 'Lentils',
    portion: portion(1, 'cup cooked', 'cups cooked'),
    ingredients: [ing('lentils', 198, '1 cup cooked green or brown lentils')],
    methods: ['stovetop'],
    dryRatio: 2.5,
    steps: [
      'Rinse, cover with 3× their volume of water and simmer 20–25 minutes until just tender.',
      'Drain, salt while warm and cool. Keeps 5 days in the fridge.',
    ],
  }),
  bed({
    id: 'lentils-rice',
    name: 'Lentils & rice',
    portion: portion(1, 'cup', 'cups'),
    uses: [use('brown-rice', 0.5), use('lentils', 0.5)],
    methods: ['no-cook'],
    steps: ['Combine half a cup each of the prepped brown rice and lentils.'],
  }),
  bed({
    id: 'quinoa-lentils',
    name: 'Quinoa & lentils',
    portion: portion(1, 'cup', 'cups'),
    uses: [use('quinoa', 0.5), use('lentils', 0.5)],
    methods: ['no-cook'],
    steps: ['Combine half a cup each of the prepped quinoa and lentils.'],
  }),
  bed({
    id: 'soba',
    name: 'Soba noodles',
    portion: portion(170, 'g cooked'),
    ingredients: [ing('soba', 170, '1 bundle (57 g dry) soba, cooked')],
    methods: ['stovetop'],
    steps: [
      'Boil 4–5 minutes, then rinse under cold water to stop them going gummy.',
      'Toss with a few drops of soy sauce. Best within 3 days.',
    ],
  }),
  bed({
    id: 'rice-noodles',
    name: 'Rice noodles',
    portion: portion(175, 'g cooked'),
    ingredients: [ing('rice-noodles', 175, '1 cup cooked rice noodles')],
    methods: ['stovetop'],
    steps: ['Soak or boil according to the packet, rinse cold and drain well. Best within 3 days.'],
  }),
  bed({
    id: 'cauliflower-rice',
    name: 'Cauliflower rice',
    portion: portion(1.5, 'cups', 'cups'),
    ingredients: [
      ing('riced-cauliflower', 150, '1½ cups riced cauliflower'),
      ing('olive-oil-spray', 1, 'Light olive oil spray'),
    ],
    methods: ['stovetop'],
    steps: ['Dry-sauté in a hot, lightly sprayed pan for 5–6 minutes until the moisture cooks off.'],
  }),
  bed({
    id: 'shirataki',
    name: 'Shirataki noodles',
    portion: portion(1, 'bag', 'bags'),
    ingredients: [ing('shirataki', 200, '1 bag shirataki (konjac) noodles')],
    methods: ['stovetop'],
    steps: [
      'Rinse and drain well.',
      'Dry-fry in a hot pan for 2–3 minutes to drive off moisture. Best made fresh or the day before.',
    ],
  }),

  // ---- Proteins ----
  protein({
    id: 'tofu-scramble',
    name: 'Tofu scramble',
    portion: portion(150, 'g tofu'),
    source: 'brief',
    ingredients: [
      ing('tofu-firm', 150, '150 g firm tofu'),
      ing('nutritional-yeast', 5, '1 tbsp nutritional yeast'),
      ing('garlic-powder', 1.5, '½ tsp garlic powder'),
      ing('turmeric', 0.75, '¼ tsp turmeric'),
      ing('salt-pepper', 0, 'Salt, to taste'),
    ],
    methods: ['stovetop'],
    steps: [
      'Mash the tofu into a hot pan over medium heat.',
      'Season with the nutritional yeast, garlic powder, turmeric and salt, and cook until lightly golden.',
      'Cool and portion. Keeps 4 days in the fridge; reheat in a pan or microwave.',
    ],
  }),
  protein({
    id: 'crispy-tofu',
    name: 'Crispy air-fried tofu',
    portion: portion(150, 'g tofu'),
    source: 'brief',
    ingredients: [
      ing('tofu-firm', 150, '150 g extra-firm tofu, pressed'),
      ing('soy-sauce', 16, '1 tbsp soy sauce'),
      ing('smoked-paprika', 1.15, '½ tsp smoked paprika'),
      ing('garlic-powder', 1.5, '½ tsp garlic powder'),
    ],
    methods: ['air-fryer'],
    steps: [
      'Press the tofu, then cut it into cubes.',
      'Toss the cubes in the soy sauce, smoked paprika and garlic powder.',
      'Air fry at 400°F (200°C) for 15–20 minutes until crisp.',
      'Keeps 4 days in the fridge; re-crisp in the air fryer for 3 minutes.',
    ],
  }),
  protein({
    id: 'tempeh',
    name: 'Soy-glazed tempeh',
    portion: portion(100, 'g tempeh'),
    ingredients: [ing('tempeh', 100, '100 g tempeh'), ing('soy-sauce', 16, '1 tbsp soy sauce')],
    methods: ['stovetop'],
    steps: [
      'Steam the whole block for 10 minutes to soften any bitterness.',
      'Slice, then sear in a hot pan with the soy sauce until glazed. Keeps 5 days.',
    ],
  }),
  protein({
    id: 'seitan',
    name: 'Seared seitan',
    portion: portion(100, 'g seitan'),
    ingredients: [ing('seitan', 100, '100 g seitan'), ing('olive-oil-spray', 1, 'Light olive oil spray')],
    methods: ['stovetop'],
    steps: ['Slice thinly and sear in a lightly sprayed pan until browned at the edges. Keeps 5 days.'],
  }),
  protein({
    id: 'yuba',
    name: 'Crispy yuba',
    portion: portion(85, 'g yuba'),
    ingredients: [ing('yuba', 85, '85 g yuba'), ing('soy-sauce', 8, '½ tbsp soy sauce')],
    methods: ['air-fryer'],
    steps: [
      'Thaw if frozen, cut into strips and toss with the soy sauce.',
      'Air fry at 375°F (190°C) for 6–8 minutes until the edges crisp. Keeps 3 days.',
    ],
  }),
  protein({
    id: 'soy-curls',
    name: 'Soy curls',
    portion: portion(40, 'g dry'),
    ingredients: [
      ing('soy-curls', 40, '40 g dry soy curls'),
      ing('soy-sauce', 8, '½ tbsp soy sauce'),
      ing('garlic-powder', 1, 'Pinch of garlic powder'),
    ],
    methods: ['air-fryer'],
    steps: [
      'Soak in warm water for 10 minutes, then squeeze dry.',
      'Toss with the soy sauce and garlic powder and air fry at 375°F (190°C) for 8 minutes. Keeps 5 days.',
    ],
  }),
  protein({
    id: 'chickn-strips',
    name: "Chick'n strips",
    portion: portion(85, 'g'),
    ingredients: [ing('chickn-strips', 85, "85 g plant-based chick'n strips")],
    methods: ['air-fryer'],
    steps: ['Air fry from frozen at 400°F (200°C) for 8–10 minutes, or as the packet says.'],
  }),
  protein({
    id: 'plant-crumbles',
    name: 'Seasoned crumbles',
    portion: portion(85, 'g'),
    ingredients: [
      ing('plant-crumbles', 85, '85 g plant-based crumbles'),
      ing('smoked-paprika', 1, '½ tsp smoked paprika'),
      ing('garlic-powder', 1, '¼ tsp garlic powder'),
    ],
    methods: ['stovetop'],
    steps: ['Brown in a dry pan, breaking it up, and season with the paprika and garlic. Keeps 4 days.'],
  }),
  protein({
    id: 'edamame',
    name: 'Edamame',
    portion: portion(125, 'g'),
    ingredients: [ing('edamame', 125, '125 g shelled edamame')],
    methods: ['stovetop'],
    steps: ['Boil from frozen for 4 minutes, drain and salt. Keeps 5 days.'],
  }),

  // ---- Veg (the bulk) ----
  veg({
    id: 'spinach-mushroom',
    name: 'Garlicky spinach & mushrooms',
    portion: portion(130, 'g'),
    ingredients: [
      ing('spinach', 60, '2 cups spinach'),
      ing('mushrooms', 70, '1 cup sliced mushrooms'),
      ing('garlic', 3, '1 garlic clove, minced'),
      ing('olive-oil-spray', 1, 'Light olive oil spray'),
    ],
    methods: ['stovetop'],
    steps: ['Sear the mushrooms in a sprayed pan, add the garlic, then wilt in the spinach. Keeps 3 days.'],
  }),
  veg({
    id: 'roasted-broccoli',
    name: 'Roasted broccoli',
    portion: portion(150, 'g'),
    ingredients: [
      ing('broccoli', 150, '150 g broccoli florets'),
      ing('olive-oil-spray', 1, 'Light olive oil spray'),
      ing('garlic-powder', 0.5, 'Pinch of garlic powder'),
    ],
    methods: ['oven', 'air-fryer'],
    steps: ['Spray, season and roast at 425°F (220°C) for 18–20 minutes until charred at the tips. Keeps 4 days.'],
  }),
  veg({
    id: 'charred-cabbage',
    name: 'Charred cabbage',
    portion: portion(0.25, 'head', 'heads'),
    source: 'brief',
    ingredients: [
      ing('cabbage', 227, '¼ head green cabbage'),
      ing('olive-oil-spray', 0.5, 'Light olive oil spray'),
      ing('garlic-salt', 0.4, 'Pinch of garlic salt'),
      ing('onion-powder', 0.3, 'Pinch of onion powder'),
      ing('nutritional-yeast', 2.5, '½ tbsp nutritional yeast'),
    ],
    methods: ['oven', 'air-fryer'],
    steps: [
      'Slice the cabbage into thick wedges or steaks.',
      'Spray lightly and coat with the garlic salt, onion powder and nutritional yeast.',
      'Roast at 400°F (200°C) until the edges are deeply caramelized. Keeps 4 days.',
    ],
  }),
  veg({
    id: 'popcorn-cauliflower',
    name: 'Popcorn cauliflower',
    portion: portion(0.5, 'head', 'heads'),
    ingredients: [
      ing('cauliflower', 294, '½ head cauliflower'),
      ing('olive-oil-spray', 1, 'Light olive oil spray'),
      ing('nutritional-yeast', 5, '1 tbsp nutritional yeast'),
      ing('garlic-powder', 0.75, '¼ tsp garlic powder'),
      ing('smoked-paprika', 0.6, '¼ tsp smoked paprika'),
    ],
    methods: ['air-fryer'],
    steps: [
      'Break the cauliflower into bite-sized florets, spray and toss with the seasonings.',
      'Air fry at 400°F (200°C) for 18–22 minutes, shaking halfway. Keeps 4 days; re-crisp before eating.',
    ],
  }),
  veg({
    id: 'smashed-cucumber',
    name: 'Smashed cucumber',
    portion: portion(0.5, 'cucumber', 'cucumbers'),
    ingredients: [ing('cucumber', 150, '½ cucumber'), ing('rice-vinegar', 10, '2 tsp rice vinegar')],
    methods: ['no-cook'],
    steps: ['Smash with the flat of a knife, cut into chunks and toss with the vinegar. Best within 2 days.'],
  }),
  veg({
    id: 'crunchy-slaw',
    name: 'Crunchy slaw',
    portion: portion(115, 'g'),
    ingredients: [
      ing('red-cabbage', 75, '1 cup shredded red cabbage'),
      ing('carrot', 40, '½ carrot, grated'),
      ing('apple-cider-vinegar', 10, '2 tsp apple cider vinegar'),
    ],
    methods: ['no-cook'],
    steps: ['Toss the cabbage and carrot with the vinegar and a pinch of salt. Keeps 5 days.'],
  }),
  veg({
    id: 'bamboo-shoots',
    name: 'Bamboo shoots',
    portion: portion(75, 'g'),
    ingredients: [ing('bamboo-shoots', 75, '½ cup bamboo shoots')],
    methods: ['no-cook'],
    steps: ['Drain and rinse.'],
  }),
  veg({
    id: 'peppers-onions',
    name: 'Roasted peppers & onions',
    portion: portion(180, 'g'),
    ingredients: [
      ing('bell-pepper', 120, '1 small bell pepper, sliced'),
      ing('onion', 60, '½ onion, sliced'),
      ing('olive-oil-spray', 1, 'Light olive oil spray'),
    ],
    methods: ['oven'],
    steps: ['Spray and roast at 425°F (220°C) for 20 minutes until soft and charred. Keeps 5 days.'],
  }),
  veg({
    id: 'mixed-greens',
    name: 'Mixed greens',
    portion: portion(60, 'g'),
    ingredients: [ing('mixed-greens', 60, '2 cups mixed greens')],
    methods: ['no-cook'],
    steps: ['Wash, spin dry and store with a paper towel.'],
  }),

  // ---- Sauces (brief section 5) ----
  sauce({
    id: 'spicy-mayo',
    name: 'Spicy creamy mayo',
    portion: SERVING,
    source: 'brief',
    briefKcal: 20,
    ingredients: [
      ing('tofu-silken', 62, '¼ cup silken tofu'),
      ing('sriracha', 17, '1 tbsp sriracha'),
      ing('apple-cider-vinegar', 5, 'Splash of apple cider vinegar'),
      ing('garlic-powder', 0.75, '¼ tsp garlic powder'),
      ing('salt-pepper', 0, 'Pinch of salt'),
    ],
    methods: ['no-cook'],
    steps: ['Whisk everything together until smooth. Keeps 5 days.'],
  }),
  sauce({
    id: 'garlic-soy-glaze',
    name: 'Sweet & savory garlic soy glaze',
    portion: SERVING,
    source: 'brief',
    briefKcal: 15,
    ingredients: [
      ing('soy-sauce', 48, '3 tbsp low-sodium soy sauce'),
      ing('rice-vinegar', 15, '1 tbsp rice vinegar'),
      ing('garlic', 3, '1 garlic clove, minced'),
      ing('ginger', 0.9, '½ tsp ginger'),
      ing('sweetener', 0, '2 tsp granulated stevia'),
    ],
    methods: ['stovetop'],
    steps: ['Combine everything in a small saucepan.', 'Simmer for 2–3 minutes until slightly reduced. Keeps 1 week.'],
  }),
  sauce({
    id: 'cheesy-garlic-dressing',
    name: 'Zesty cheesy garlic dressing',
    portion: SERVING,
    source: 'brief',
    briefKcal: 35,
    ingredients: [
      ing('nutritional-yeast', 10, '2 tbsp nutritional yeast'),
      ing('water', 30, '2 tbsp warm water'),
      ing('lemon-juice', 15, '1 tbsp lemon juice'),
      ing('garlic-powder', 1.5, '½ tsp garlic powder'),
      ing('salt-pepper', 0, 'Salt and pepper, to taste'),
    ],
    methods: ['no-cook'],
    steps: ['Stir everything together vigorously until smooth. Keeps 5 days.'],
  }),
  sauce({
    id: 'buffalo-sauce',
    name: 'Tangy buffalo sauce',
    portion: SERVING,
    source: 'brief',
    briefKcal: 3,
    ingredients: [
      ing('hot-sauce', 30, '2 tbsp cayenne hot sauce'),
      ing('white-vinegar', 15, '1 tbsp white vinegar'),
      ing('garlic-salt', 0.75, '¼ tsp garlic salt'),
      ing('xanthan-gum', 0.2, 'Pinch of xanthan gum'),
    ],
    methods: ['no-cook'],
    steps: ['Whisk everything together. The xanthan gum thickens it within a minute. Keeps 2 weeks.'],
  }),
  sauce({
    id: 'sesame-free-glaze',
    name: 'Sticky sweet sesame-free glaze',
    portion: SERVING,
    source: 'brief',
    briefKcal: 8,
    ingredients: [
      ing('soy-sauce', 16, '1 tbsp soy sauce'),
      ing('rice-vinegar', 15, '1 tbsp rice vinegar'),
      ing('sweetener', 0, '1 tsp monk fruit sweetener'),
      ing('xanthan-gum', 0.2, 'Tiny pinch of xanthan gum'),
    ],
    methods: ['no-cook'],
    steps: ['Whisk the soy sauce, vinegar and sweetener together.', 'Whisk in a tiny pinch of xanthan gum until sticky.'],
  }),
  sauce({
    id: 'dill-pickle-dip',
    name: 'Creamy dill pickle dip',
    portion: SERVING,
    source: 'brief',
    briefKcal: 18,
    ingredients: [
      ing('tofu-silken', 62, '¼ cup silken tofu'),
      ing('pickle-juice', 30, '2 tbsp pickle juice'),
      ing('dill-pickles', 10, '1 tbsp finely diced dill pickles'),
      ing('dried-herbs', 0.5, '½ tsp dried dill'),
    ],
    methods: ['blender'],
    steps: ['Blend everything until smooth and creamy. Keeps 5 days.'],
  }),
  sauce({
    id: 'maple-bbq',
    name: 'Smokey maple-BBQ reduction',
    portion: SERVING,
    source: 'brief',
    briefKcal: 25,
    ingredients: [
      ing('tomato-paste', 32, '2 tbsp tomato paste'),
      ing('liquid-smoke', 0, '¼ tsp liquid smoke'),
      ing('apple-cider-vinegar', 15, '1 tbsp apple cider vinegar'),
      ing('sweetener', 0, 'Maple-flavored stevia drops, to taste'),
      ing('onion-powder', 0.6, '¼ tsp onion powder'),
      ing('water', 30, '2 tbsp water'),
    ],
    methods: ['stovetop'],
    steps: ['Whisk everything together in a small saucepan.', 'Simmer, stirring, for 3–4 minutes until reduced and glossy.'],
  }),
  sauce({
    id: 'lemon-herb-tahini',
    name: 'Creamy lemon-herb "tahini"',
    portion: SERVING,
    source: 'brief',
    briefKcal: 16,
    ingredients: [
      ing('tofu-silken', 62, '¼ cup silken tofu'),
      ing('lemon-juice', 30, '2 tbsp lemon juice'),
      ing('garlic', 3, '1 clove garlic, as paste'),
      ing('dried-herbs', 0.5, '½ tsp dried oregano and parsley'),
      ing('water', 15, '1 tbsp warm water, to thin'),
    ],
    methods: ['no-cook'],
    steps: [
      'Whisk the silken tofu, lemon juice, garlic paste and herbs until smooth.',
      'Thin with warm water to a drizzling consistency. Keeps 5 days.',
    ],
  }),

  // ---- Toppings ----
  topping({
    id: 'sesame-seeds',
    name: 'Toasted sesame seeds',
    portion: portion(1, 'tbsp'),
    ingredients: [ing('sesame-seeds', 9, '1 tbsp sesame seeds')],
    methods: ['stovetop'],
    steps: ['Toast in a dry pan for 2–3 minutes, shaking, until golden. Store in a jar.'],
  }),
  topping({
    id: 'pumpkin-seeds',
    name: 'Pumpkin seeds',
    portion: portion(1, 'tbsp'),
    ingredients: [ing('pumpkin-seeds', 10, '1 tbsp pumpkin seeds')],
    methods: ['no-cook'],
    steps: ['Use as they are, or toast in a dry pan until they start to pop.'],
  }),
  topping({
    id: 'hemp-hearts',
    name: 'Hemp hearts',
    portion: portion(1, 'tbsp'),
    ingredients: [ing('hemp-hearts', 10, '1 tbsp hemp hearts')],
    methods: ['no-cook'],
    steps: ['Sprinkle straight from the bag.'],
  }),
  topping({
    id: 'crispy-shallots',
    name: 'Crispy shallots',
    portion: portion(1, 'tbsp'),
    ingredients: [ing('crispy-shallots', 5, '1 tbsp crispy fried shallots')],
    methods: ['no-cook'],
    steps: ['Sprinkle on just before eating so they stay crisp.'],
  }),
  topping({
    id: 'nori',
    name: 'Nori strips',
    portion: portion(1, 'sheet', 'sheets'),
    ingredients: [ing('nori', 3, '1 nori sheet, cut into strips')],
    methods: ['no-cook'],
    steps: ['Snip into thin strips with scissors.'],
  }),
  topping({
    id: 'chili-crisp',
    name: 'Chili crisp',
    portion: portion(1, 'tsp'),
    ingredients: [ing('chili-crisp', 5, '1 tsp chili crisp')],
    methods: ['no-cook'],
    steps: ['Spoon over the bowl. A little goes a long way.'],
  }),
  topping({
    id: 'nooch-sprinkle',
    name: 'Nutritional yeast',
    portion: portion(1, 'tbsp'),
    ingredients: [ing('nutritional-yeast', 5, '1 tbsp nutritional yeast')],
    methods: ['no-cook'],
    steps: ['Sprinkle over the bowl for a cheesy finish.'],
  }),

  // ---- Snacks ----
  snack({
    id: 'protein-fluff',
    name: 'Blended protein fluff',
    portion: SERVING,
    source: 'brief',
    ingredients: [
      ing('tofu-silken', 150, '150 g silken tofu'),
      ing('frozen-berries', 140, '1 cup frozen strawberries or blueberries'),
      ing('almond-milk', 60, 'Splash of unsweetened almond milk'),
      ing('xanthan-gum', 0.6, '¼ tsp xanthan gum'),
      ing('sweetener', 0, 'Stevia, to taste'),
    ],
    methods: ['blender'],
    steps: [
      'Add everything to a blender.',
      'Blend on high for 3 full minutes. The xanthan gum forces air into the silken tofu, expanding it into a massive dessert-bowl texture.',
    ],
  }),
  snack({
    id: 'veggie-batons',
    name: 'Veggie batons & dill dip',
    portion: SERVING,
    ingredients: [ing('cucumber', 300, '1 cucumber'), ing('celery', 120, '3 celery stalks')],
    uses: [use('dill-pickle-dip')],
    methods: ['no-cook'],
    steps: ['Cut the cucumber and celery into batons and pack with a serving of dill pickle dip. Keeps 4 days.'],
  }),
  snack({
    id: 'edamame-cup',
    name: 'Edamame cup',
    portion: SERVING,
    ingredients: [ing('edamame', 150, '150 g shelled edamame'), ing('salt-pepper', 0, 'Flaky salt')],
    methods: ['stovetop'],
    steps: ['Boil from frozen for 4 minutes, drain, salt and portion into cups. Keeps 5 days.'],
  }),
  snack({
    id: 'berry-smoothie',
    name: 'Silken berry smoothie',
    portion: SERVING,
    ingredients: [
      ing('tofu-silken', 150, '150 g silken tofu'),
      ing('frozen-berries', 140, '1 cup frozen berries'),
      ing('almond-milk', 120, '½ cup unsweetened almond milk'),
      ing('ice', 140, '1 cup ice'),
      ing('xanthan-gum', 0.6, '¼ tsp xanthan gum'),
      ing('sweetener', 0, 'Stevia, to taste'),
    ],
    methods: ['blender'],
    steps: ['Add everything to a blender.', 'Blend on high for 2–3 minutes until thick and roughly doubled in volume.'],
  }),
  snack({
    id: 'cabbage-chips',
    name: 'Late-night charred cabbage chips',
    portion: SERVING,
    source: 'brief',
    ingredients: [
      ing('cabbage', 908, '1 head green cabbage'),
      ing('olive-oil-spray', 2, 'Light olive oil spray'),
      ing('garlic-salt', 1.5, '½ tsp garlic salt'),
      ing('onion-powder', 1.2, '½ tsp onion powder'),
      ing('nutritional-yeast', 10, '2 tbsp nutritional yeast'),
    ],
    methods: ['air-fryer', 'oven'],
    steps: [
      'Slice the cabbage into thick wedges or steaks.',
      'Spray lightly with oil and coat heavily with the garlic salt, onion powder and nutritional yeast.',
      'Bake at 400°F (200°C) or air fry until the edges are deeply caramelized and crispy.',
    ],
  }),
];

export const COMPONENTS: Record<ComponentId, Component> = Object.fromEntries(COMPONENT_LIST.map((c) => [c.id, c]));

/** Looks up a component by id without matching inherited object keys such as "constructor". */
export const getComponent = (id: ComponentId): Component | undefined =>
  Object.hasOwn(COMPONENTS, id) ? COMPONENTS[id] : undefined;
