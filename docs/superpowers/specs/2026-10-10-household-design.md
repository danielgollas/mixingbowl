# Mixing Bowl — Cooking for More Than One Person

**Date:** 2026-10-10
**Builds on:** `2026-10-04-bowl-builder-design.md`.
**Goal:** Prep and shop for a household. Everyone shares the week's menu, but each person has their own target weight and meals, so portions scale per person and the prep and shopping lists add everyone up.

## 1. Decisions

| Topic | Decision |
|---|---|
| People | A list of 1–8 people, each with a name, a target weight (optional) and the meals they eat (at least one). The first launch has one person, "Me". |
| Shared | Start date, weight unit, the weekly menus, your own bowls, and prep/shopping checks. |
| Menu | One menu per week. The Menu shows a section for every meal that anyone eats, with who eats it. |
| Scaling | Per person per day, with that person's protein target (unchanged rule: protein first, then bed, ≤ 1,500 kcal). |
| Today | Shows one person at a time. With two or more people, a switcher picks whose day it is; the choice is saved. Eaten history is per person. |
| Prep & shopping | The sum over everyone. With two or more people, each prep line also shows each person's share ("Me 1,800 g tofu · Alex 900 g tofu"). |
| Removing a person | Asks for confirmation inline (no browser dialog), then deletes that person and their eaten history. The last person can't be removed. |

## 2. Data

- `Person { id, name, targetWeight: number | null, meals: Slot[] }`.
- Storage `version: 3`: `{ settings: { startDate, unit }, people: Person[], activePerson, eaten: Record<personId, Record<date, Slot[]>>, menus, customMeals, checks }`.
- Versions 1 and 2 upgrade into one person (`id: 'me'`, name "Me") holding the old target weight, meals and eaten history.
- Repair: invalid people are dropped. Duplicate ids are dropped. Names are trimmed, and blank ones become "Person N". Meals fall back to Snack + Dinner. No valid people → the default person. `activePerson` falls back to the first person. Eaten history for unknown people is dropped.

## 3. Logic

- `planInput(data, person)` builds one person's plan input.
- `householdTotals(data, week)` returns the combined `WeekTotals` and each person's totals.
- `prepList(totals, shares?)` adds a `shares` line per component when more than one person is given.

## 4. Screens

- **Settings:** the start date and the lb/kg unit stay at the top. A "People" card holds one block per person (name, target weight with the existing validation, meals checkboxes, Remove with inline confirm) and an "Add person" button. Switching units converts everyone's weight.
- **Today:** a segmented switcher with each person's name, shown when there are two or more people. The rest of the page is that person's day.
- **Menu:** each section's meta line lists who eats that meal when there are two or more people.
- **Prep / Shopping:** the totals cover everyone. The Prep summary says "for N people" when there is more than one person.

## 5. Testing

- Storage: v2 → v3 and v1 → v3 upgrades; repair rules; round-trip.
- Prep: household totals add each person's scaled portions; shares line; a person who doesn't eat a meal adds nothing for it.
- UI: add a person, set their weight and meals; the Today switcher changes the meals and saves the choice; eaten is per person; Prep shows shares; remove with confirm; Menu shows who eats each meal.

## 6. Also in this change

- **More variations per week.** "Add" works on a full week: the new item takes one day from the entry with the most days (the last of them on a tie). A meal can have up to seven different items; Add is disabled only when every day already has its own item.
- **Fat, fiber and sugars.** Every food gains `fatPer100g`, `fiberPer100g` and `sugarPer100g` (approximate USDA values; total sugars). `Nutrition` becomes `{ kcal, protein, fat, fiber, sugar }`. Today shows the day's planned and eaten fat, fiber and sugars under the meters; meal cards, Menu entries and recipe pages show them too. Scaling still uses only calories and protein.
- **Printable week.** `#/print` and `#/print/:week`, linked from Prep: the week's menu as a day-by-meal table, every batch-prep recipe with ingredient totals for the whole household (grams, and packs where the food has one) and its steps, then the shopping list. Print styles hide the tab bar and buttons, keep recipes from splitting across pages, and start each section on a new page.
