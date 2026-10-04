# Mixing Bowl

A mobile-first daily companion for the high-volume vegan meal plan in
[`project_brief_high_volume_vegan.md`](project_brief_high_volume_vegan.md).

**Live:** https://danielgollas.github.io/mixingbowl/

Meals are prep-friendly bowls: a **bed** (rice, quinoa, noodles, lentils…), a **protein** (tofu, tempeh, seitan,
yuba, soy curls…), as many **veg** as you like, a **sauce** and a **topping**. Snacks are a separate short list.

- **Today**: the meals you eat that day, scaled to your targets (protein first, then the bed), with eaten
  toggles and calorie and protein totals.
- **Menu**: per program week, choose the bowls and snacks for each meal you eat and how many days each one covers.
  Swap any slot of a preset to make your own bowl.
- **Prep**: one batch-prep list for the week, like "14 cups cooked brown rice" or "uses 4.5 blocks extra-firm tofu".
- **Shopping**: the week's shopping list, rounded up to whole packs.
- **Settings**: start date, which meals you eat, and target weight (lb or kg).

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
