import { useWeek } from '../components/WeekHeader';
import { COMPONENTS } from '../data/components';
import { FOODS } from '../data/foods';
import { SLOT_LABELS } from '../data/meals';
import type { Ingredient } from '../data/types';
import { formatDecimal, formatNumber, formatShortDate } from '../lib/format';
import { entryForDay, findMeal, householdMeals, resolveMenu } from '../lib/menu';
import { householdTotals, prepList, shoppingList } from '../lib/prep';
import { weekDays } from '../lib/program';
import { hrefFor } from '../router';
import { useAppState } from '../state';

const formatBatchGrams = (grams: number): string =>
  grams < 10 ? `${formatDecimal(grams)} g` : `${formatNumber(grams)} g`;

/** One ingredient multiplied out for the whole batch, e.g. "1,800 g extra-firm tofu (4.5 blocks)". */
function batchIngredient(ingredient: Ingredient, servings: number): string {
  const food = FOODS[ingredient.foodId];
  if (ingredient.grams === 0) return ingredient.amount;
  const grams = ingredient.grams * servings;
  const packs = food.pack ? ` (${formatDecimal(grams / food.pack.grams)} ${food.pack.units})` : '';
  return `${formatBatchGrams(grams)} ${food.name.toLowerCase()}${packs}`;
}

export function PrintWeek({ week: routeWeek }: { week: number | null }) {
  const { data } = useAppState();
  const week = useWeek(routeWeek);
  const days = weekDays(data.settings.startDate, week);
  const menu = resolveMenu(data.menus, week);
  const slots = householdMeals(data.people);
  const { totals, people } = householdTotals(data, week);
  const groups = prepList(totals, people);
  const shopping = shoppingList(totals);

  return (
    <div class="print-page">
      <header class="page-header">
        <div class="no-print title-row">
          <a class="back-link" href={hrefFor({ name: 'prep', week })}>
            Prep
          </a>
          <button type="button" class="button-secondary" onClick={() => window.print()}>
            Print
          </button>
        </div>
        <p class="eyebrow">{`${formatShortDate(days[0])} – ${formatShortDate(days[6])}`}</p>
        <h1>{`Week ${week} recipes`}</h1>
        <p class="meta">
          {`For ${data.people.map((p) => p.name).join(', ')} · ${totals.meals} meals · portions scaled to each person's targets`}
        </p>
      </header>

      <section class="print-section" aria-labelledby="print-menu">
        <h2 id="print-menu">Menu</h2>
        <table class="print-table">
          <thead>
            <tr>
              <th scope="col">Day</th>
              {slots.map((slot) => (
                <th key={slot} scope="col">
                  {SLOT_LABELS[slot]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((date, index) => (
              <tr key={date}>
                <th scope="row">{`${index + 1} · ${formatShortDate(date)}`}</th>
                {slots.map((slot) => {
                  const entry = entryForDay(menu[slot], index + 1);
                  const meal = entry && findMeal(entry.mealId, data.customMeals);
                  return <td key={slot}>{meal ? meal.name : '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="print-section" aria-labelledby="print-prep">
        <h2 id="print-prep">Batch prep</h2>
        {groups.map((group) => (
          <div key={group.role} class="print-group">
            <h3>{group.title}</h3>
            {group.lines.map((line) => {
              const component = COMPONENTS[line.id];
              const servings = totals.components.get(line.id) ?? 0;
              return (
                <article key={line.id} class="recipe">
                  <h4>{line.name}</h4>
                  <p class="meta">{[line.amount, ...line.details].join(' · ')}</p>
                  {line.shares && <p class="meta">{line.shares}</p>}
                  <ul class="ingredients">
                    {component.uses.map((use) => (
                      <li key={use.componentId}>
                        {`${COMPONENTS[use.componentId].name} × ${formatDecimal(servings * use.servings)} (see ${COMPONENTS[use.componentId].role === 'sauce' ? 'Sauces' : 'above'})`}
                      </li>
                    ))}
                    {component.ingredients.map((ingredient, i) => (
                      <li key={i}>
                        {batchIngredient(ingredient, servings)}
                        {ingredient.grams > 0 && <span class="meta">{` · ${ingredient.amount} per portion`}</span>}
                      </li>
                    ))}
                  </ul>
                  <ol class="steps">
                    {component.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </div>
        ))}
      </section>

      <section class="print-section" aria-labelledby="print-shopping">
        <h2 id="print-shopping">Shopping list</h2>
        <div class="print-columns">
          {shopping.map((group) => (
            <div key={group.category} class="print-group">
              <h3>{group.category}</h3>
              <ul class="print-checklist">
                {group.lines.map((line) => (
                  <li key={line.id}>
                    <span aria-hidden="true">☐ </span>
                    {line.name}
                    {line.amount && <span class="meta">{` — ${line.amount}`}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
