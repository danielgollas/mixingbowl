# Mixing Bowl — Design Spec

**Date:** 2026-09-14
**Source brief:** `project_brief_high_volume_vegan.md`
**Goal:** A mobile-first daily companion web app for the brief's high-volume vegan plan, published to GitHub Pages from the public repo `danielgollas/mixingbowl`.

## 1. Decisions

| Topic | Decision |
|---|---|
| App purpose | Daily companion: today's meals, recipes/sauces, shopping checklist. No weight tracking. |
| Nutrition | Show estimated kcal + protein per meal and per day. When the planned day is below the brief's floors, suggest top-up add-ons. |
| Stack | Vite 8 + Preact 10 + TypeScript, Vitest 5 + jsdom + @testing-library/preact. Node 22 (`.nvmrc`). |
| Hosting | Public GitHub repo, GitHub Pages deployed by GitHub Actions (`build_type=workflow`). |
| Persistence | `localStorage` only. No backend, no network calls. |
| Routing | Hash routes (`#/today`), so deep links and reloads work on Pages without a 404 fallback. |

## 2. Screens & behavior

Bottom tab bar with five tabs: **Today**, **Week**, **Recipes**, **Shopping**, **Settings**. Recipe detail is a sub-route of Recipes.

### Today (`#/today`, default route)
- Header: "Day N · Week W" and a Pattern A / Pattern B badge.
- If the start date is in the future: "Program starts in N days" and a preview of Day 1.
- If target weight is unset: a prompt card linking to Settings (protein target unknown).
- Four meal cards (Breakfast, Lunch, Snack, Dinner & Night Cravings). Each shows the meal name, estimated kcal and protein, and a toggle to mark it eaten (`aria-pressed`). Tapping the name opens the recipe.
- Totals bar: eaten-so-far and planned kcal against the 1,200–1,500 kcal range; eaten and planned protein against the protein target range.
- Top-ups card (only when the planned day is short): each suggested add-on with amount, kcal and protein; the resulting day totals; and any remaining unmet gap.

### Week (`#/week`)
- The seven days of the current program week, with dates, pattern, and planned kcal/protein per day. Today is highlighted.
- Each day lists its four meal names, linking to recipes.

### Recipes (`#/recipes`, `#/recipes/:id`)
- List grouped into **Master recipes** (brief recipes 1–4), **Plan meals** (the salad and the Pattern B meals), and **Sauces** (8).
- Detail: name, "Derived from brief" badge if not written in the brief, method tags (Air fryer / Stovetop / Blender / Oven / No-cook), total kcal + protein, ingredients with amounts (a sub-recipe shows as a linked line), numbered steps, and for sauces "Brief lists ~X kcal" when that differs from the computed value.

### Shopping (`#/shopping`)
- Brief section 6 grouped by category; each item is a checkbox that persists.
- "New week" button clears all checks.

### Settings (`#/settings`)
- Start date (date input; defaulted to the first-launch date and saved).
- Target weight + unit (lb / kg). Valid range 80–600 lb (36–272 kg); invalid input shows an inline error and is not saved.
- Shows the derived protein target range.
- Notice if storage is unavailable ("Progress won't be saved in this browser").

### Footer (all screens)
The brief's disclaimer plus "Nutrition figures are estimates."

## 3. Program day logic (`src/lib/program.ts`)

- Dates are local calendar dates as `YYYY-MM-DD` strings.
- `daysBetween(a, b)`: difference computed from `Date.UTC(y, m-1, d)` of each date part, so DST transitions cannot shift the count.
- `programDay = daysBetween(startDate, today)` (0-based). Negative means the program hasn't started.
- `cycleDay = (programDay mod 7) + 1` (1..7); `week = floor(programDay / 7) + 1`.
- Pattern: odd `cycleDay` → A, even → B. Day 7 (A) is followed by Day 1 (A), matching the brief.
- `weekDates(startDate, today)`: the 7 dates of the current program week (week 1 when not yet started).

## 4. Data model (`src/data/`)

```ts
type FoodId = string;
interface Food { id: FoodId; name: string; kcalPer100g: number; proteinPer100g: number }

interface Ingredient { foodId: FoodId; grams: number; amount: string } // amount = display text, e.g. "2 cups"
interface Component { recipeId: RecipeId; servings: number }            // sub-recipe

type Method = 'air-fryer' | 'stovetop' | 'blender' | 'oven' | 'no-cook';
interface Recipe {
  id: RecipeId; name: string;
  kind: 'master' | 'meal' | 'sauce';
  source: 'brief' | 'derived';
  methods: Method[];
  ingredients: Ingredient[];
  components: Component[];
  steps: string[];
  briefKcal?: number;          // sauces: the brief's stated kcal
}

type Slot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
type Pattern = 'A' | 'B';
type Plan = Record<Pattern, Record<Slot, RecipeId>>;
```

"To taste" seasonings (salt, pepper) are ingredients with `grams: 0`.

### 4.1 Food table (per 100 g; approximate USDA FoodData Central values)

| id | Food | kcal | protein g | Reference portion |
|---|---|---|---|---|
| tofu-firm | Firm / extra-firm tofu | 144 | 17.3 | — |
| tofu-silken | Silken tofu | 55 | 4.8 | 1/4 cup = 62 g |
| spinach | Spinach | 23 | 2.9 | 1 cup = 30 g |
| mushrooms | Mushrooms, sliced | 22 | 3.1 | 1 cup = 70 g |
| riced-cauliflower | Riced cauliflower | 25 | 1.9 | 1 cup = 100 g |
| cauliflower | Cauliflower head | 25 | 1.9 | 1 head = 588 g |
| cabbage | Green cabbage | 25 | 1.3 | 1 head = 908 g |
| mixed-greens | Mixed greens | 17 | 1.5 | 1 cup = 30 g |
| cucumber | Cucumber | 15 | 0.7 | 1 medium = 300 g |
| celery | Celery | 14 | 0.7 | 1 stalk = 40 g |
| bamboo-shoots | Bamboo shoots, canned | 19 | 1.7 | 1/2 cup = 75 g |
| shirataki | Shirataki noodles | 10 | 0 | 1 bag = 200 g |
| frozen-berries | Frozen strawberries/blueberries | 45 | 0.7 | 1 cup = 140 g |
| almond-milk | Almond milk, unsweetened | 15 | 0.6 | splash = 60 g |
| ice | Ice | 0 | 0 | 1 cup = 140 g |
| soy-sauce | Low-sodium soy sauce / tamari | 53 | 8.1 | 1 tbsp = 16 g |
| rice-vinegar | Rice vinegar | 18 | 0 | 1 tbsp = 15 g |
| apple-cider-vinegar | Apple cider vinegar | 22 | 0 | 1 tbsp = 15 g |
| white-vinegar | White vinegar | 18 | 0 | 1 tbsp = 15 g |
| sriracha | Sriracha | 93 | 1.9 | 1 tbsp = 17 g |
| hot-sauce | Cayenne hot sauce | 11 | 0.5 | 1 tbsp = 15 g |
| pickle-juice | Pickle juice | 8 | 0 | 1 tbsp = 15 g |
| dill-pickles | Dill pickles | 12 | 0.5 | 1 tbsp diced = 10 g |
| tomato-paste | Tomato paste | 82 | 4.3 | 1 tbsp = 16 g |
| liquid-smoke | Liquid smoke | 0 | 0 | — |
| lemon-juice | Lemon juice | 22 | 0.4 | 1 tbsp = 15 g |
| olive-oil-spray | Olive oil spray | 884 | 0 | light spray = 2 g |
| water | Water | 0 | 0 | — |
| nutritional-yeast | Nutritional yeast | 400 | 50 | 1 tbsp = 5 g |
| xanthan-gum | Xanthan gum | 333 | 0 | 1/4 tsp = 0.6 g |
| sweetener | Stevia / monk fruit | 0 | 0 | — |
| garlic-powder | Garlic powder | 331 | 16.6 | 1 tsp = 3 g |
| onion-powder | Onion powder | 341 | 10.4 | 1 tsp = 2.4 g |
| smoked-paprika | Smoked paprika | 282 | 14.1 | 1 tsp = 2.3 g |
| turmeric | Turmeric | 312 | 9.7 | 1 tsp = 3 g |
| ginger | Ground ginger | 335 | 9.0 | 1 tsp = 1.8 g |
| garlic | Garlic, fresh / paste | 149 | 6.4 | 1 clove = 3 g |
| garlic-salt | Garlic salt | 80 | 4.0 | 1 tsp = 3 g |
| dried-herbs | Dried herbs (dill, oregano, parsley) | 270 | 15 | 1 tsp = 1 g |
| salt-pepper | Salt / pepper | 0 | 0 | — |
| seitan | Seitan, prepared | 130 | 21 | top-up only |
| tempeh | Tempeh | 192 | 20.3 | top-up only |
| edamame | Edamame, shelled, cooked | 121 | 11.9 | top-up only |

### 4.2 Recipes

Brief recipes use the brief's quantities; unquantified seasonings get the reference portions above. "Derived" recipes are composed from the brief's meal descriptions.

| id | Name | Kind | Source | Contents |
|---|---|---|---|---|
| tofu-scramble | The Infinite Tofu Scramble | master | brief | tofu-firm 150 g; spinach 2 cups; mushrooms 1 cup; riced-cauliflower 1 cup; nutritional-yeast 1 tbsp; garlic-powder 1/2 tsp; turmeric 1/4 tsp; salt to taste |
| crispy-tofu | Crispy Air-Fried Tofu Base | master | brief | tofu-firm 150 g; soy-sauce 1 tbsp; smoked-paprika 1/2 tsp; garlic-powder 1/2 tsp |
| protein-fluff | The Massive Blended Protein Fluff | master | brief | tofu-silken 150 g; frozen-berries 1 cup; almond-milk splash; xanthan-gum 1/4 tsp; sweetener to taste |
| cabbage-chips | Late-Night Charred Cabbage Chips | master | brief | cabbage 1 head; olive-oil-spray light; garlic-salt 1/2 tsp; onion-powder 1/2 tsp; nutritional-yeast 2 tbsp |
| crispy-tofu-salad | Air-Fried Crispy Tofu Salad | meal | derived | component crispy-tofu ×1; mixed-greens 4 cups; cucumber 1/2; rice-vinegar 2 tbsp (light vinegar dressing) |
| berry-smoothie | Silken Berry Protein Smoothie | meal | derived | tofu-silken 150 g; frozen-berries 1 cup; almond-milk 1/2 cup (120 g); ice 1 cup; xanthan-gum 1/4 tsp; sweetener to taste |
| shirataki-stir-fry | Shirataki Noodle & Tofu Stir-Fry | meal | derived | shirataki 1 bag; tofu-firm 150 g; bamboo-shoots 1/2 cup; component garlic-soy-glaze ×1 |
| veggie-batons | Raw Vegetable Batons with Dill Pickle Dip | meal | derived | cucumber 1; celery 3 stalks; component dill-pickle-dip ×1 |
| popcorn-cauliflower | Popcorn Cauliflower Mountain | meal | derived | cauliflower 1 head; olive-oil-spray light; nutritional-yeast 2 tbsp; garlic-powder 1/2 tsp; onion-powder 1/2 tsp; smoked-paprika 1/2 tsp |
| spicy-mayo | The Spicy Creamy Mayo | sauce | brief (~20) | tofu-silken 1/4 cup; sriracha 1 tbsp; apple-cider-vinegar splash (1 tsp = 5 g); garlic-powder 1/4 tsp; salt pinch |
| garlic-soy-glaze | Sweet & Savory Garlic Soy Glaze | sauce | brief (~15) | soy-sauce 3 tbsp; rice-vinegar 1 tbsp; garlic 1 clove; ginger 1/2 tsp; sweetener 2 tsp |
| cheesy-garlic-dressing | Zesty Cheesy Garlic Dressing | sauce | brief (~35) | nutritional-yeast 2 tbsp; water 2 tbsp; lemon-juice 1 tbsp; garlic-powder 1/2 tsp; salt-pepper to taste |
| buffalo-sauce | Zero-Calorie Tangy Buffalo Wing Sauce | sauce | brief (~3) | hot-sauce 2 tbsp; white-vinegar 1 tbsp; garlic-salt 1/4 tsp; xanthan-gum pinch (0.2 g) |
| sesame-free-glaze | Sticky Sweet Sesame-Free Glaze | sauce | brief (~8) | soy-sauce 1 tbsp; rice-vinegar 1 tbsp; sweetener 1 tsp; xanthan-gum pinch (0.2 g) |
| dill-pickle-dip | Creamy Dill Pickle Dip | sauce | brief (~18) | tofu-silken 1/4 cup; pickle-juice 2 tbsp; dill-pickles 1 tbsp; dried-herbs 1/2 tsp |
| maple-bbq | Smokey Maple-BBQ Reduction | sauce | brief (~25) | tomato-paste 2 tbsp; liquid-smoke 1/4 tsp; apple-cider-vinegar 1 tbsp; sweetener drops; onion-powder 1/4 tsp; water 2 tbsp |
| lemon-herb-tahini | Creamy Lemon-Herb "Tahini" Swap | sauce | brief (~16) | tofu-silken 1/4 cup; lemon-juice 2 tbsp; garlic 1 clove; dried-herbs 1/2 tsp; water 1 tbsp |

Steps come from the brief's "Execution" text; derived recipes get short steps consistent with the brief's modalities (air fryer 400°F / 200°C, stovetop). Method tags come from the same text.

### 4.3 Plan

| Slot | Pattern A (days 1, 3, 5, 7) | Pattern B (days 2, 4, 6) |
|---|---|---|
| breakfast | tofu-scramble | berry-smoothie |
| lunch | crispy-tofu-salad | shirataki-stir-fry |
| snack | protein-fluff | veggie-batons |
| dinner | cabbage-chips | popcorn-cauliflower |

Expected planned totals (sanity check, ±5%): Pattern A ≈ 1,025 kcal / 90 g protein; Pattern B ≈ 770 kcal / 63 g protein.

### 4.4 Shopping list

Brief section 6 as categories (Proteins, Volume Bases, Noodle Sub, Pantry & Condiments, Spices & Thickening Agents), each item with a stable id. Top-up foods are listed in an extra "Optional Top-ups" category (seitan, tempeh, edamame).

## 5. Nutrition (`src/lib/nutrition.ts`)

- `foodNutrition(foodId, grams) → { kcal, protein }` = per-100 g × grams / 100.
- `recipeNutrition(recipeId)` = Σ ingredients + Σ (component nutrition × servings). Recursive; data integrity tests guarantee no cycles.
- `patternTotals(pattern)` = Σ of the four slot recipes.
- `eatenTotals(pattern, eatenSlots)` = Σ of eaten slot recipes.
- Values stay unrounded internally; display rounds kcal to an integer and protein to whole grams.

## 6. Targets & top-ups (`src/lib/topups.ts`)

- `KCAL_MIN = 1200`, `KCAL_MAX = 1500`.
- `proteinTarget(weight, unit) → { min, max } | null`: convert kg→lb (×2.20462), min = 0.8 × lb, max = 1.0 × lb. Null when weight unset.
- Add-on catalogue (portion step, max portions):

| food | step | max |
|---|---|---|
| seitan | 50 g | 2 |
| tofu-firm | 50 g | 2 |
| tempeh | 50 g | 2 |
| edamame | 75 g (1/2 cup) | 2 |

- `suggestTopUps(planned, proteinMin | null)` algorithm:
  1. Loop while `kcal < KCAL_MIN` or (`proteinMin` set and `protein < proteinMin`).
  2. Candidates are add-ons with portions left whose next portion keeps `kcal ≤ KCAL_MAX`. Sort them by protein per kcal, highest first (seitan > tofu > tempeh > edamame). Ties keep catalogue order.
  3. If there are no candidates, stop. Otherwise add one portion of the first candidate.
  4. Return `{ items: [{ foodId, grams, kcal, protein }], after: { kcal, protein }, unmet: { kcal, protein } }`. Items merge portions per food and keep the order each food was first picked. `unmet.kcal = max(0, KCAL_MIN − after.kcal)`; `unmet.protein = proteinMin ? max(0, proteinMin − after.protein) : 0`.
- Worked example (Pattern A, 160 lb target, proteinMin 128): seitan ×2, tofu ×2 → ≈ 1,299 kcal / 128 g; nothing unmet.

## 7. State & storage (`src/lib/storage.ts`, `src/state.ts`)

Single key `mixingbowl:v1`:

```ts
interface Stored {
  version: 1;
  settings: { startDate: string; targetWeight: number | null; unit: 'lb' | 'kg' };
  eaten: Record<string /* YYYY-MM-DD */, Slot[]>;
  shopping: Record<string /* itemId */, true>;
}
```

- `load(storage, today)`: missing, unparseable, wrong version or wrong shape → defaults (`startDate = today`, `targetWeight = null`, `unit = 'lb'`, empty maps). Invalid fields are replaced field by field, so one bad field doesn't wipe the rest.
- `save(storage, state)`: wrapped in try/catch; returns `false` on failure.
- Storage access itself (e.g. `window.localStorage` throwing in private mode) is caught; the app runs in memory and exposes `persistent: false`.
- `useAppState()` hook: holds state in Preact state, writes through `save` on every change, and exposes actions: `toggleEaten(date, slot)`, `toggleShopping(id)`, `clearShopping()`, `setSettings(partial)`.
- "Today" comes from an injectable clock (`today()` in `src/lib/clock.ts`) so tests can fix the date.

## 8. Project structure

```
index.html
vite.config.ts            base '/mixingbowl/', preact preset, vitest (jsdom)
tsconfig.json             strict, jsx react-jsx, jsxImportSource preact
.nvmrc                    22
.github/workflows/deploy.yml
src/main.tsx              render <App/>
src/app.tsx               shell: header, route outlet, footer, tab bar
src/router.ts             useHashRoute(): parses location.hash → { name, params }
src/state.ts              useAppState()
src/styles.css            mobile-first CSS, custom properties, light/dark
src/lib/{clock,program,nutrition,topups,storage}.ts (+ .test.ts)
src/data/{types,foods,recipes,plan,shopping,addons}.ts (+ data.test.ts)
src/views/{Today,Week,Recipes,RecipeDetail,Shopping,Settings}.tsx
src/components/{TabBar,MealCard,TotalsBar,TopUps}.tsx
src/app.test.tsx          UI smoke tests
```

## 9. Styling & accessibility

- Plain CSS with custom properties; `prefers-color-scheme` dark variant; max content width ~40rem, centered.
- Fixed bottom tab bar with safe-area inset padding; tap targets ≥ 44 px.
- Tab links use `aria-current="page"`; eaten toggles use `aria-pressed`; checkboxes are real `<input type="checkbox">` with labels.
- Emoji SVG favicon 🥣; title "Mixing Bowl".

## 10. Testing

Vitest with jsdom. `npm test` = `vitest run`.

- **program:** day/week/pattern for day 0, 6, 7, 13; Day 7 → Day 1 both A; future start date; DST boundary (e.g. 2026-03-07 → 2026-03-09 = 2 days); `weekDates`.
- **data integrity:** every `foodId` and component `recipeId` exists; no component cycles; every plan slot references a recipe of kind meal/master; the 4 master recipes and 8 sauces are present; recipe and shopping ids are unique.
- **nutrition:** `foodNutrition` math; component recursion with servings; Pattern A/B totals within ±5% of §4.3.
- **topups:** no items when already met; kcal-only mode when `proteinMin` null; never exceeds `KCAL_MAX`; respects max portions; greedy order; merged items; `unmet` reported when unreachable; the §6 worked example.
- **storage:** defaults on missing/corrupt/wrong-version data; per-field repair; round-trip; `save` returns false when `setItem` throws.
- **UI smoke (`app.test.tsx`):** for a fixed date, Today shows the right day/pattern and four meals; toggling eaten updates totals and persists; with target weight set, the top-ups card shows seitan; the shopping check persists and "New week" clears it; navigating `#/recipes/crispy-tofu-salad` shows the linked Crispy Air-Fried Tofu Base component; an invalid Settings weight shows an error.

## 11. Build & deploy

- Scripts: `dev` (vite), `build` (`tsc --noEmit && vite build`), `preview` (vite preview), `test` (vitest run).
- TypeScript: use the latest (7.x). If the native compiler is incompatible with the toolchain, fall back to the latest 5.x and note it in the README.
- Workflow `.github/workflows/deploy.yml`, on push to `main` and `workflow_dispatch`:
  - job `build`: `actions/checkout@v7`, `actions/setup-node@v7` (node-version-file `.nvmrc`, npm cache), `npm ci`, `npm test`, `npm run build`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` (path `dist`).
  - job `deploy` (needs build; permissions `pages: write`, `id-token: write`; environment `github-pages`): `actions/deploy-pages@v5`.
- Repo setup: `gh repo create danielgollas/mixingbowl --public --source . --push`; enable Pages with `gh api -X POST repos/danielgollas/mixingbowl/pages -f build_type=workflow`.
- Live URL: `https://danielgollas.github.io/mixingbowl/`.

## 12. Verification before "done"

1. `npm test` passes; `npm run build` succeeds.
2. `vite preview` checked in a browser at phone width: all five tabs render, eaten toggle and shopping checks survive a reload, recipe deep link works.
3. The Actions run is green and the live URL loads the app, including assets under `/mixingbowl/`.

## 13. Out of scope

Weight logging and progress charts; editing recipes or the plan; custom foods; syncing across devices; logging sauces or top-ups as eaten; PWA/offline install.
