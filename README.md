# Mixing Bowl

A mobile-first daily companion for the high-volume vegan meal plan in
[`project_brief_high_volume_vegan.md`](project_brief_high_volume_vegan.md).

**Live:** https://danielgollas.github.io/mixingbowl/

Meals are prep-friendly bowls: a **bed** (rice, quinoa, noodles, lentils…), a **protein** (tofu, tempeh, seitan,
yuba, soy curls…), as many **veg** as you like, a **sauce** and a **topping**. Snacks are a separate short list.

- **Today**: the meals you eat that day, scaled to your targets (protein first, then the bed), with eaten
  toggles, calorie and protein meters, and fat, fiber and sugars. With more than one person, switch whose day it is.
- **Menu**: per program week, choose the bowls and snacks for each meal and how many days each one covers (up to
  seven different items). Swap any slot of a preset to make your own bowl, or 🎲 one part at random.
  **Randomize week** fills every meal with random picks (with Undo). A card at the top shows each person's daily
  averages (calories, protein against their target, fat, fiber, sugars) and their calorie deficit.
- **Recipes**: roll a fully random bowl (lock the parts you like, re-roll the rest, save it), and browse every
  bowl, snack and part with search by name or ingredient, filters and sorting. Each bowl has its own page with
  its parts and nutrition and an Add to menu button.
- **Prep**: one batch-prep list for the whole household, like "14 cups cooked brown rice" or "uses 4.5 blocks
  extra-firm tofu", with each person's share. **Print** turns the week into a cookbook: menu, batch recipes and
  shopping list.
- **Shopping**: the week's shopping list, rounded up to whole packs.
- **Portions**: each person's daily calories are their maintenance less their deficit (500 kcal by default), never
  under 1,200 kcal, or 1,500 for men; without maintenance the day aims for 1,200–1,500 kcal. Protein aims for 0.7–1.0 g
  per lb of target weight. Every bowl gets at least 400 g of vegetables. A short day grows proteins, beds and snacks
  together, up to double, and Today says when that still isn't enough. Sauces and toppings stay as they are.
- **Weekly fast**: each person can pick one day of the program week with no meals. Today says so, Prep and Shopping
  leave out their portions, and the Menu's deficit counts it.
- **Settings**: start date, weight unit, and the people you cook for, each with their own target weight, meals and
  maintenance calories (for the deficit).

Everything is saved in the browser's `localStorage`; there is no backend. Optionally, **iCloud sync** keeps the plan
in your own private iCloud database (CloudKit JS), so you can sign in with your Apple ID on any device, and
**household sharing** lets someone else edit the same plan with their own Apple ID.

**On iPhone:** open the live site in Safari, tap Share → **Add to Home Screen**. It opens full screen with its own
icon and works offline after the first visit (`public/sw.js` keeps the page and its built files). The home screen
app has its own storage, separate from Safari's, so sign in to iCloud sync there to bring your plan over.

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

## iCloud sync setup

Sync is off until the build has a CloudKit container and web API token.

1. [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list/cloudContainer) →
   Identifiers → iCloud Containers → **+**, e.g. `iCloud.io.github.danielgollas.mixingbowl`.
2. [CloudKit Console](https://icloud.developer.apple.com/) → the container → **Schema** (Development) → Record Types →
   **+** `AppData` with one field `plan` of type **String**. Then **Deploy Schema Changes…** to Production.
   Sharing also needs the `cloudkit.share` type, which CloudKit only creates the first time a share is made in
   Development: run the app against `development`, tap **Share plan**, then deploy the schema again.
3. CloudKit Console → **Tokens & Keys** (API Access) → new **API Token**: Sign In Callback **Post Message**,
   Allowed Origins `https://danielgollas.github.io` (add `http://localhost:5173` for development).
4. Repository variables (Settings → Secrets and variables → Actions → Variables), then re-run the deploy:
   ```sh
   gh variable set CLOUDKIT_CONTAINER --body iCloud.io.github.danielgollas.mixingbowl
   gh variable set CLOUDKIT_API_TOKEN --body <token>
   gh variable set CLOUDKIT_ENVIRONMENT --body production
   ```
   Locally, put the same values in `.env.local` as `VITE_CLOUDKIT_CONTAINER`, `VITE_CLOUDKIT_API_TOKEN` and
   `VITE_CLOUDKIT_ENVIRONMENT` (use `development` to test against the development database, with an API token made in that environment; tokens only work in one).

The token is meant to be public: CloudKit web tokens only work from the allowed origins, and each user only reaches
their own private database.

### Household sharing

Settings → iCloud sync → **Share plan** gives an invite link (`…/#/join/<code>`). Whoever opens it signs in with
their own Apple ID and joins; from then on both edit one plan, with the same newer-edit-wins sync. The plan lives in a
`Household` zone of the owner's private database (plans saved before sharing existed are copied there once; the old
copy is left as it was) and is shared with a CloudKit share anyone with the link can accept. **Stop sharing** deletes
the share and everyone who joined goes back to their own plan; **Leave** does that for one person. The record type and
field are the same, so no schema change is needed beyond step 2.

## Data

- Foods, components (beds, proteins, veg, sauces, toppings, snacks) and preset meals live in `src/data/`.
- Calories and protein come from approximate USDA FoodData Central values per 100 g
  (`src/data/foods.ts`). They are estimates and will differ from product labels.
- Components marked "From the brief" follow its recipes and sauces; the rest were added for bowl variety.
- Design notes: [`docs/superpowers/specs/`](docs/superpowers/specs/) (the original app, the bowl builder, households, iCloud sync, recipes and randomizing).

*This is for informational purposes only. For medical advice or diagnosis, consult a professional.*
