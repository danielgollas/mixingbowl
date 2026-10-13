# Mixing Bowl — Recipes, Randomizing and Menu Stats

**Date:** 2026-10-13
**Builds on:** `2026-10-10-household-design.md`, `2026-10-12-icloud-sync-design.md`.
**Goal:** Browse every bowl, snack and part in one place; roll random bowls, parts and weeks; and see each person's daily macros and calorie deficit while editing the menu.

## 1. Decisions

| Topic | Decision |
|---|---|
| Recipes tab | New tab `#/recipes`, between Menu and Prep: Today, Menu, Recipes, Prep, Shopping, Settings. Random bowl at the top, the explorer below. |
| Explorer | One list of every bowl (presets and your own), snack and part. Search matches names and ingredient names, including ingredients of sub-components. Filter chips (single choice): All, Bowls, Snacks, Beds, Proteins, Veg, Sauces, Toppings. Sort: Name, Most protein, Fewest kcal, Protein per kcal. Each row: name, kind or role, kcal, protein, and fat · fiber · sugars. |
| Bowl page | `#/bowls/:id` for presets, your own bowls and snacks: parts linked to their recipe pages, nutrition, "Add to menu" (meal + week, current week by default, uses `addEntry`). Your own bowls also show the swap editor and a Delete with inline confirm when no menu uses it. Unknown id → "Recipe not found". |
| Parts | Open the existing `#/components/:id`. |
| Random bowl | Fully random: one bed, one protein, 1–3 veg (no repeats), one sauce, one topping, from every component of that role. Each part has 🎲 (re-roll just this part, always a different option when there is one) and 🔒 (keep on "Roll again"). "Roll again" re-rolls unlocked parts. "Save bowl" saves it as your own bowl named "{Protein} & {Bed} with {Sauce}" and opens its bowl page. The roll lasts until you leave the page. |
| Swap one part | Menu's swap editor (and the bowl page editor) gets 🎲 next to Bed, Protein, Sauce and Topping, and "Random veg" (a new random set of the same size). Editing a preset still copies it first. |
| Random week | Menu: "Randomize week" asks inline: variations per meal 2 / 3 / 4 (default 3), Randomize / Cancel. Each meal anyone eats gets that many different items picked at random from presets and your own bowls of the right kind (all of them when there are fewer), days split as evenly as possible with the larger shares first (3+2+2). Replaces only that week. "Undo" restores the previous entries until you leave the page or edit the menu again. No new bowls are created. |
| Menu stats | A card at the top of Menu with one block per person, for the week shown, from that person's scaled plan: average per day of kcal, protein (with the person's target range), fat, fiber and sugars; and the calorie deficit. Live as the menu changes. Days with nothing planned count as 0 and the card says how many days are unplanned. |
| Deficit | New optional `Person.maintenance` (kcal/day, 1,000–5,000), set in Settings ("Maintenance calories", with a hint to use a TDEE calculator). Deficit per day = maintenance − average planned kcal; per week ×7; "≈ X lb/week" (or kg) at 3,500 kcal per lb (7,700 per kg). A negative deficit reads as a surplus. No maintenance → "Add maintenance calories in Settings to see the deficit." |

## 2. Data

- `Person.maintenance: number | null` (default null). Repair: finite number within 1,000–5,000, else null. Storage stays `version: 3`; older data reads as null.
- No other storage changes; random bowls are ordinary custom meals.

## 3. Code

- `lib/random.ts`: `type Rng = () => number` (default `Math.random`); `pick`, `rollBowl(locked, rng)`, `rerollPart(meal, role, rng)`, `randomVeg(count, rng)`, `randomWeek(slots, customMeals, variations, rng)`, `bowlName(parts)`.
- `lib/explore.ts`: `recipeItems(customMeals)`, `filterItems(items, query, filter)`, `sortItems(items, sort)`.
- `lib/stats.ts`: `personWeekStats(data, person, week)` → averages, unplanned days, deficit.
- `components/BowlEditor.tsx` (moved from Menu), `components/MenuStats.tsx`, `components/RandomBowl.tsx`.
- `views/Recipes.tsx`, `views/BowlDetail.tsx`; router adds `recipes` and `bowl`; TabBar gets the Recipes tab (current on `recipes`, `bowl` and `component`).
- `state`: `deleteCustomMeal(id)`.

## 4. Testing

- Random (seeded rng): every roll is a valid bowl; locks are kept; a part re-roll changes the part; random veg keeps the count; random week has no repeats within a meal, sums to 7 days, splits evenly, and uses every option when there are fewer than asked.
- Explore: search by name and by sub-component ingredient; filters; each sort.
- Stats: averages from scaled days; unplanned days; deficit and lb/kg per week; surplus; no maintenance.
- Storage: maintenance repair.
- UI: Recipes tab; search + filter; roll, lock, re-roll, save → bowl page; add to menu from a bowl page; delete your own bowl; 🎲 in the swap editor; randomize week, then undo; Menu stats update when an entry is added; maintenance field in Settings; 6 tabs fit at 375 px.
