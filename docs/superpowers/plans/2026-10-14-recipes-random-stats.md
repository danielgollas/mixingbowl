# Recipes, Randomizing and Menu Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Recipes tab (explorer + random bowl), single-part and whole-week randomizing, and live per-person stats with calorie deficit on Menu.

**Architecture:** Pure logic in `lib/random.ts`, `lib/explore.ts` and `lib/stats.ts`, each tested on its own; views compose them. No storage format change beyond the optional `Person.maintenance`.

**Tech Stack:** Vite 8, Preact 10, TypeScript 7, Vitest 5 + @testing-library/preact (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-13-recipes-random-stats-design.md`

## Global Constraints

- Storage stays `version: 3`; `Person.maintenance` is `number | null`, valid range 1,000–5,000 kcal/day.
- Bowl rules unchanged: exactly 1 bed and 1 protein, ≤ 1 sauce, ≤ 1 topping, any number of veg (random rolls use 1–3).
- Six tabs in order: Today, Menu, Recipes, Prep, Shopping, Settings; no horizontal overflow at 375 px.
- 3,500 kcal per lb, 7,700 kcal per kg.
- Randomness always goes through an injectable `Rng = () => number`.

## Review Focus

- Re-rolling a part with only one option of that role → keeps it, never loops forever. Test in Task 2.
- Random week when a meal has fewer options than the variations asked → uses every option once, still 7 days. Test in Task 3.
- Undo after randomizing, then editing the menu → Undo disappears (never restores over newer edits). Test in Task 3.
- Deleting your own bowl used by some week's menu → Delete is not offered. Test in Task 5.
- A person with scaling off, or a week with unplanned days → stats average over 7 days and show the unplanned count. Test in Task 1.

---

### Task 1: Maintenance calories and Menu stats

**Files:** Modify `src/lib/storage.ts`, `src/views/Settings.tsx`, `src/views/Menu.tsx`, `src/styles.css`. Create `src/lib/stats.ts`, `src/lib/stats.test.ts`, `src/components/MenuStats.tsx`. Tests in `src/lib/storage.test.ts`, `src/app.test.tsx`.

**Produces:** `Person.maintenance: number | null`; `MAINTENANCE_RANGE = { min: 1000, max: 5000 }`; `personWeekStats(data: AppData, person: Person, week: number): { average: Nutrition; unplannedDays: number; target: Range | null; deficit: { perDay: number; perWeek: number; weightPerWeek: number } | null }`.

- [ ] Tests: repair of `maintenance` (valid kept, 900/6000/"x" → null, missing → null); stats average = sum of scaled day totals / 7; unplanned days count days missing any of the person's meals; deficit = maintenance − average kcal, perWeek ×7, weightPerWeek = perWeek / 3500 (lb) or / 7700 (kg); negative for surplus; null without maintenance.
- [ ] Implement storage + stats; run tests.
- [ ] UI: Settings field "Maintenance calories" (number, kcal/day, validates like target weight, blank = null); `MenuStats` card at the top of Menu: per person name (when > 1), kcal and protein vs target, fat/fiber/sugars, deficit line ("Deficit 450 kcal/day · ≈ 0.9 lb/week" or "Surplus …"), or the Settings prompt; unplanned note.
- [ ] App tests: stats show and change after adding an entry; maintenance field saves and the deficit appears.
- [ ] Commit.

### Task 2: Random parts and the shared bowl editor

**Files:** Create `src/lib/random.ts`, `src/lib/random.test.ts`, `src/components/BowlEditor.tsx` (moved from Menu). Modify `src/views/Menu.tsx`.

**Produces:** `type Rng`; `pick<T>(list: readonly T[], rng): T`; `ROLL_ROLES = ['bed','protein','veg','sauce','topping']`; `type Locks = Partial<Record<Role, boolean>>`; `rollBowl(current: ComponentId[] | null, locks: Locks, rng): ComponentId[]`; `rerollPart(parts: ComponentId[], role: Role, rng): ComponentId[]`; `randomVeg(count: number, rng, exclude?: ComponentId[]): ComponentId[]`; `bowlName(parts): string`; `seeded(seed: number): Rng` (mulberry32, tests).

- [ ] Tests (seeded): 200 rolls all `isValidMeal`; veg count 1–3 without repeats; locks keep those roles' parts; rerollPart changes the part and leaves others; with a one-option role it returns the same parts; randomVeg keeps count; bowlName "{Protein} & {Bed} with {Sauce}" and without sauce "{Protein} & {Bed}".
- [ ] Implement; run tests.
- [ ] Move `BowlEditor` to `components/` and add 🎲 buttons (aria-label "Random bed" etc.) and "Random veg"; app test: 🎲 on a preset's sauce saves a custom copy with a different sauce.
- [ ] Commit.

### Task 3: Random week

**Files:** Modify `src/lib/random.ts`, `src/lib/random.test.ts`, `src/views/Menu.tsx`, `src/app.test.tsx`.

**Produces:** `randomWeek(slots: Slot[], customMeals: CustomMeals, variations: number, rng): Partial<Record<Slot, MenuEntry[]>>`; `splitDays(n: number): number[]` (7 over n, larger first).

- [ ] Tests: splitDays(3) = [3,2,2], (2) = [4,3], (4) = [2,2,2,1]; no repeats per slot, right kind, sums to 7; fewer options than asked → each once.
- [ ] Implement; Menu "Randomize week" with inline 2/3/4 + Randomize/Cancel; Undo restores the previous entries for each slot; any later `setMenu` hides Undo.
- [ ] App tests: randomize changes the menu, Undo restores it; Undo gone after a stepper edit.
- [ ] Commit.

### Task 4: Recipes tab, explorer and random bowl

**Files:** Create `src/lib/explore.ts`, `src/lib/explore.test.ts`, `src/views/Recipes.tsx`, `src/components/RandomBowl.tsx`. Modify `src/router.ts`, `src/router.test.ts`, `src/components/TabBar.tsx`, `src/app.tsx`, `src/styles.css`, `src/app.test.tsx`.

**Produces:** routes `{ name: 'recipes' }` (`#/recipes`) and `{ name: 'bowl'; id: string }` (`#/bowls/:id`); `RecipeItem { kind: 'bowl' | 'snack' | 'part'; id; name; role: Role | null; nutrition: Nutrition; href; search: string }`; `type RecipeFilter = 'all' | 'bowls' | 'snacks' | Exclude<Role,'snack'>`; `type RecipeSort = 'name' | 'protein' | 'kcal' | 'density'`; `recipeItems(customMeals)`, `filterItems(items, query, filter)`, `sortItems(items, sort)`.

- [ ] Tests: items include presets, custom bowls, snacks and non-snack parts; search "peanut" finds the sauce and bowls using it, case-insensitive, via sub-component ingredients; filters; sorts. Router parses/builds the new routes.
- [ ] Implement explorer view (search input, chip radios, sort select, list with links), Recipes tab icon, RandomBowl card (roll on mount, 🎲 and 🔒 per part, Roll again, Save bowl → `saveCustomMeal` + navigate to `#/bowls/:id`).
- [ ] App tests: tab shows and is current; search + filter; roll/lock/re-roll/save opens the bowl page; 6 tabs.
- [ ] Commit.

### Task 5: Bowl page

**Files:** Create `src/views/BowlDetail.tsx`. Modify `src/state.tsx` (`deleteCustomMeal(id)`), `src/app.tsx`, `src/app.test.tsx`, `src/state.test.tsx`.

- [ ] Bowl page: parts with links, nutrition stats, Add to menu (slot select limited to the meal kind's slots, week number input defaulting to current week, `addEntry`), editor for own bowls, Delete with inline confirm only when no week's menu references it; not found state.
- [ ] Tests: add to menu puts it in that week; delete hidden when used, works when unused; not found.
- [ ] Commit.

### Task 6: Docs and deploy

- [ ] README features list; full test run; build; check pages at 375 px in the browser; push; confirm the deploy.
