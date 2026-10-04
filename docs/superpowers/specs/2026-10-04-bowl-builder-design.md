# Mixing Bowl — Bowl Builder & Batch Prep Design Spec

**Date:** 2026-10-04
**Builds on:** `2026-09-14-mixingbowl-design.md` (stack, hosting, routing, storage plumbing, styling and deploy stay as described there unless replaced below).
**Goal:** Replace the fixed Pattern A/B plan with prep-friendly bowls. You choose which meals you eat and which bowls or snacks fill each week; the app scales portions to your targets, then turns the week into one batch-prep list and one shopping list.

## 1. Decisions

| Topic | Decision |
|---|---|
| Meals eaten | Setting "Meals you eat": any of Breakfast, Lunch, Snack, Dinner. Default Snack + Dinner. At least one stays on. |
| Bowl shape | Five slots: **bed**, **protein**, **veg** (any number, including none), **sauce** (optional), **topping** (optional). Bed and protein are required. |
| Snacks | A separate short list (not five-slot bowls). Breakfast and Snack pick from snacks; Lunch and Dinner pick from bowls. |
| Presets | Ten preset bowls built from the shared component catalogue, plus five snacks. |
| Swaps | Editing a preset bowl in a week turns it into your own bowl (a copy with the same slots, named "<preset> (custom)", renamable). Your own bowls are shared across weeks; editing one changes it everywhere it's used. |
| Weekly menu | Per program week and per meal: a list of items with day counts that add up to at most 7. Days are filled in order. A week with no saved menu uses the nearest earlier saved week, or the default menu. |
| Scaling | Per day. Protein portions grow first, then beds; veg, sauce and topping never scale. Never over 1,500 kcal. Replaces the old seitan/tempeh top-ups. |
| Reuse | Components are shared across bowls. Combo beds (lentils & rice, quinoa & lentils) are built from the single beds, so the prep list has one rice line no matter which bowls use rice. |
| Prep & shopping | Both are computed from the week's scaled menu. Checks are kept per program week. |
| Removed | Pattern A/B, the Week tab, the Recipes tab, the fixed plan, top-ups. |

## 2. Data model (`src/data/`)

### 2.1 Foods (`foods.ts`)
`Food { id, name, kcalPer100g, proteinPer100g, category, pack?, cookedPerDry? }`
- `category`: one of `Proteins`, `Produce`, `Grains & Noodles`, `Nuts & Seeds`, `Sauces & Condiments`, `Spices & Baking`, `Basics`. `Basics` (water, ice, salt & pepper) never appear on the shopping list.
- `pack { grams, unit, units }`: how the food is bought, e.g. extra-firm tofu `{397, 'block', 'blocks'}`, tempeh `{227, 'pack', 'packs'}`, cauliflower `{588, 'head', 'heads'}`.
- `cookedPerDry`: grams of cooked food per gram dry (beds are entered cooked; shopping shows dry weight).
- New foods (approximate USDA values, cooked where noted): brown rice (cooked), quinoa (cooked), lentils (cooked), soba (cooked), rice noodles (cooked), yuba, soy curls (dry), plant-based chick'n strips, plant-based crumbles, broccoli, bell pepper, onion, carrot, red cabbage, sesame seeds, pumpkin seeds, hemp hearts, crispy fried shallots, nori, chili crisp. Brand names are not used.

### 2.2 Components (`components.ts`)
`Component { id, name, role, portion, ingredients, uses, methods, steps, source, briefKcal?, dryRatio? }`
- `role`: `bed | protein | veg | sauce | topping | snack`.
- One component = **one portion**. `portion { amount, unit, units }`, e.g. brown rice `{1, 'cup cooked', 'cups cooked'}`, tofu scramble `{150, 'g tofu', 'g tofu'}`, charred cabbage `{0.25, 'head', 'heads'}`.
- `ingredients`: foods for one portion (grams drive the math; `amount` is display text).
- `uses`: other components inside this one, with servings (combo beds use ½ + ½ of single beds; veggie batons use one dill pickle dip).
- `dryRatio`: cooked cups per dry cup, for the prep line ("≈ 2⅓ cups dry").
- Catalogue:
  - **Beds:** brown rice, quinoa, lentils, lentils & rice, quinoa & lentils, soba, rice noodles, cauliflower rice, shirataki.
  - **Proteins:** tofu scramble (the brief's scramble without its veg), crispy air-fried tofu (brief), soy-glazed tempeh, seared seitan, crispy yuba, soy curls, chick'n strips, plant-based crumbles, edamame.
  - **Veg:** garlicky spinach & mushrooms, roasted broccoli, charred cabbage (the brief's cabbage chips, ¼ head), popcorn cauliflower (½ head), smashed cucumber, crunchy slaw, bamboo shoots, roasted peppers & onions, mixed greens.
  - **Sauces:** the brief's eight sauces, unchanged.
  - **Toppings:** sesame seeds, pumpkin seeds, hemp hearts, crispy shallots, nori, chili crisp, nutritional yeast.
  - **Snacks:** protein fluff (brief), veggie batons + dill dip, edamame cup, silken berry smoothie, late-night charred cabbage chips (brief, whole head).

### 2.3 Meals (`meals.ts`)
`Meal { id, name, kind: 'bowl' | 'snack', parts: ComponentId[] }`
- A bowl is valid when it has exactly one bed and one protein, at most one sauce and one topping, any number of veg, no other roles and no duplicates. A snack's parts are snack components.
- Ten preset bowls, e.g. *Scramble Bowl* = brown rice + tofu scramble + spinach & mushrooms + cheesy garlic dressing + hemp hearts; *Crispy Tofu Bowl* = brown rice + crispy tofu + smashed cucumber + crunchy slaw + spicy mayo + sesame seeds.
- Five preset snacks, one per snack component.
- `SLOT_KIND`: breakfast → snack, lunch → bowl, snack → snack, dinner → bowl.
- `DEFAULT_MENU`: two items per meal with counts 4 + 3.

## 3. Logic (`src/lib/`)

### 3.1 Program (`program.ts`)
Pattern logic is removed. `programPosition(start, today) → { started, daysUntilStart, day (1..7), week }`. `weekStart(start, week)` and `weekDays(start, week)` give a program week's dates. The 4am day start is unchanged.

### 3.2 Nutrition (`nutrition.ts`)
`componentNutrition(id)` adds its ingredients and its `uses` (times servings), recursively. `mealNutrition(meal, servings)` adds each part times its servings (default 1).

### 3.3 Menu (`menu.ts`)
- `MenuEntry { mealId, days }`; `WeekMenu = Partial<Record<Slot, MenuEntry[]>>`.
- `resolveMenu(menus, week)`: the saved menu for that week, else the nearest earlier saved week, else `DEFAULT_MENU`.
- `entryForDay(entries, day)`: entries cover days in order; returns `null` for unplanned days.
- `findMeal(id, customMeals)`: preset or custom.
- `dayMeals(data, week, day)`: the meals planned for each eaten slot on that day.

### 3.4 Scaling (`scaling.ts`)
`scaleDay(meals, proteinMin) → { meals: [{ slot, meal, servings, nutrition }], total, shortBy: { kcal, protein }, over }`
1. Start every part at one serving.
2. While the day is short (below 1,200 kcal, or below `proteinMin` when a target weight is set):
   - Add half a serving to the protein part (across the day's bowls) with the most protein per kcal that is under +2 servings and still fits under 1,500 kcal.
   - If no protein part fits, add half a serving to the first bed under +1 that still fits.
   - If nothing fits, stop.
3. `shortBy` is what's still missing; `over` is how far the unscaled day already exceeds 1,500 kcal (possible with four meals).
Snack parts never scale.

### 3.5 Prep and shopping (`prep.ts`)
- `weekTotals(data, week)` runs `scaleDay` for each of the 7 days and expands every part into component servings (including `uses`, recursively) and food grams.
- `prepList(totals)`: one line per component that has its own ingredients, grouped by role (Beds, Proteins, Veg, Sauces, Toppings, Snacks). Each line shows the total portion ("7 cups cooked"), the dry amount for beds with `dryRatio`, and "uses 2.6 blocks extra-firm tofu" for each packaged ingredient.
- `shoppingList(totals)`: one line per food (excluding `Basics`), grouped by category. Packaged foods show "buy N units" rounded up (5% tolerance, so 3.02 blocks buys 3) with "uses X"; foods with `cookedPerDry` show the dry weight; other produce, grains and proteins show grams; sauces, condiments and spices show just the name.

### 3.6 Targets (`targets.ts`)
The old `topups.ts` minus the top-up algorithm: `KCAL_MIN`, `KCAL_MAX`, protein target, weight units and ranges, `convertWeight`.

## 4. Screens

Tabs: **Today**, **Menu**, **Prep**, **Shopping**, **Settings**.

### Today (`#/today`)
- Header: date, "Day N · Week W". Not started: a notice and a preview of Day 1.
- No target weight: the Settings prompt card, as before.
- Totals bar with the scaled planned totals and the eaten totals.
- One card per eaten meal: the meal name, scaled kcal and protein, the eaten toggle, and the parts with their scaled portions ("Tofu scramble · 225 g tofu ×1.5"). Each part links to its component page. An unplanned day shows "Nothing planned for dinner" and a link to the Menu.
- A status line when scaling couldn't reach the targets ("Still about 12 g short of your protein target") or when the day is over 1,500 kcal.

### Menu (`#/menu`, `#/menu/:week`)
- Week header with dates and ‹ › links (week 1 is the floor).
- One section per eaten meal. Each entry shows the name, which days it covers ("Days 1–4"), one-portion kcal and protein, a stepper (−/+; minimum 1, the total can't pass 7) and Remove.
- "N days unplanned" when the counts add up to less than 7.
- An "Add" select lists the presets and your own items of the right kind; a new entry takes the remaining days. It's disabled when all 7 days are planned.
- Bowls have an Edit toggle that opens the swap editor: name, a select each for bed and protein, veg checkboxes, a select each for sauce and topping (with "None"). Editing a preset first copies it into your own bowl and points this week's entry at it.
- The first edit to a week saves the resolved menu for that week, so later weeks keep following it.

### Prep (`#/prep`, `#/prep/:week`)
- Week header with ‹ ›. "Prepping for N meals."
- The prep list grouped by role, each line a checkbox with its amount text and a link to the component.

### Shopping (`#/shopping`, `#/shopping/:week`)
- Week header with ‹ ›, "N of M checked", and an "Uncheck all" button.
- The shopping list grouped by category, each line a checkbox.

### Component page (`#/components/:id`)
Name, role, portion, kcal and protein per portion, ingredients (and linked sub-components), method steps, "Brief lists ~X kcal" for sauces when the estimate differs. Not-found state for unknown ids.

### Settings (`#/settings`)
Adds "Meals you eat" checkboxes (the last checked one is disabled). Start date and target weight stay as before.

## 5. State & storage

- Same storage key (`mixingbowl:v1`) so existing data is found. `version: 2`:
  `{ version: 2, settings: { startDate, targetWeight, unit, meals }, eaten, menus: Record<week, WeekMenu>, customMeals: Record<id, Meal>, checks: Record<week, { prep: string[], shopping: string[] }> }`
- `load` migrates version 1: keeps settings and eaten, adds `meals: ['snack', 'dinner']`, empty menus, custom meals and checks. The old shopping checks are dropped.
- Field-by-field repair as before. Menu entries pointing at unknown meals are dropped, days must be integers 1–7, and an entry that would push a meal past 7 days is dropped. Invalid custom meals are dropped.
- New state actions: `setMenu(week, slot, entries)`, `saveCustomMeal(meal)`, `togglePrep(week, id)`, `toggleShoppingItem(week, id)`, `clearShopping(week)`. `toggleEaten` and `setSettings` stay.

## 6. Testing

- **data:** every food and `uses` reference exists; no `uses` cycles; every preset bowl and snack is valid; the default menu is valid; ids are unique; all 8 brief sauces present.
- **nutrition:** component recursion with `uses`; meal totals with servings.
- **scaling:** no change when targets are already met; kcal-only without a target; protein grows before beds; caps (+2 protein, +1 bed); never over 1,500; `shortBy` when unreachable; snacks never scale; `over` for a four-meal day.
- **menu:** day assignment in order; unplanned days; nearest-earlier fallback; default menu.
- **prep/shopping:** combo beds fold into single-bed lines; servings add across days; pack rounding with tolerance; dry weight; basics excluded.
- **storage:** v1 migration; v2 round-trip; invalid entries and custom meals dropped; defaults on corrupt data.
- **UI:** Today shows the eaten meals with scaled portions and toggles eaten; Menu stepper caps at 7 and Add fills the remaining days; editing a preset creates a custom bowl and updates Today and Prep; Prep and Shopping checks persist per week; Settings meal checkboxes change Today; component page deep link; router for the new routes.

## 7. Verification before "done"

1. `npm test` passes; `npm run build` succeeds.
2. `vite preview` at 375 px: all tabs render, a swap updates Prep, checks survive a reload.
3. The Actions run is green and the live site serves the new build.

## 8. Out of scope

Snack editing; custom components or foods; per-day manual overrides of portions; deleting custom bowls (they just stop being used); sharing menus across devices.
