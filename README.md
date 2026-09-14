# Mixing Bowl

A mobile-first daily companion for the high-volume vegan meal plan in
[`project_brief_high_volume_vegan.md`](project_brief_high_volume_vegan.md).

**Live:** https://danielgollas.github.io/mixingbowl/

- **Today** — the program day, Pattern A/B meals, eaten toggles, calorie and protein totals, and top-up
  suggestions when the plan as written falls below 1,200 kcal or your protein target.
- **Week** — the seven days of the current program week.
- **Recipes** — the brief's master recipes, the plan's other meals, and the eight sauces.
- **Shopping** — the brief's shopping list as a checklist, plus items the recipes need that it leaves out.
- **Settings** — start date and target weight (lb or kg).

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

- Foods, recipes, the plan, shopping list and top-ups live in `src/data/`.
- Calories and protein come from approximate USDA FoodData Central values per 100 g
  (`src/data/foods.ts`). They are estimates and will differ from product labels.
- Recipes marked "derived" were composed from the brief's meal descriptions, which don't include recipes.
- Design notes: [`docs/superpowers/specs/2026-09-14-mixingbowl-design.md`](docs/superpowers/specs/2026-09-14-mixingbowl-design.md).

*This is for informational purposes only. For medical advice or diagnosis, consult a professional.*
