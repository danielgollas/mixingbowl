# Mixing Bowl

A mobile-first daily companion for the high-volume vegan meal plan in
[`project_brief_high_volume_vegan.md`](project_brief_high_volume_vegan.md).

**Live:** https://danielgollas.github.io/mixingbowl/

Meals are prep-friendly bowls: a **bed** (rice, quinoa, noodles, lentils…), a **protein** (tofu, tempeh, seitan,
yuba, soy curls…), as many **veg** as you like, a **sauce** and a **topping**. Snacks are a separate short list.

- **Today**: the meals you eat that day, scaled to your targets (protein first, then the bed), with eaten
  toggles, calorie and protein meters, and fat, fiber and sugars. With more than one person, switch whose day it is.
- **Menu**: per program week, choose the bowls and snacks for each meal and how many days each one covers (up to
  seven different items). Swap any slot of a preset to make your own bowl.
- **Prep**: one batch-prep list for the whole household, like "14 cups cooked brown rice" or "uses 4.5 blocks
  extra-firm tofu", with each person's share. **Print** turns the week into a cookbook: menu, batch recipes and
  shopping list.
- **Shopping**: the week's shopping list, rounded up to whole packs.
- **Settings**: start date, weight unit, and the people you cook for, each with their own target weight and meals.

Everything is saved in the browser's `localStorage`; there is no backend.

## Development

Requires Node 22.22.2 or newer (`nvm use`).

```sh
npm install
npm run dev       # http://localhost:5173/mixingbowl/
npm test          # Vitest (jsdom)
npm run build     # type-check with TypeScript 7, then build to dist/
npm run preview   # serve dist/ at http://localhost:4173/mixingbowl/
```

Pushes to `main` run the tests, build, and deploy to GitHub Pages via `.github/workflows/deploy.yml`.

## Data

- Foods, components (beds, proteins, veg, sauces, toppings, snacks) and preset meals live in `src/data/`.
- Calories and protein come from approximate USDA FoodData Central values per 100 g
  (`src/data/foods.ts`). They are estimates and will differ from product labels.
- Components marked "From the brief" follow its recipes and sauces; the rest were added for bowl variety.
- Design notes: [`docs/superpowers/specs/`](docs/superpowers/specs/) (the original app, then the bowl builder).

*This is for informational purposes only. For medical advice or diagnosis, consult a professional.*
