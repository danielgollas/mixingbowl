import { useMemo, useState } from 'preact/hooks';
import { RandomBowl } from '../components/RandomBowl';
import { filterItems, recipeItems, sortItems, type RecipeFilter, type RecipeItem, type RecipeSort } from '../lib/explore';
import { formatExtras, formatGrams, formatKcal } from '../lib/format';
import { ROLE_TITLES } from '../lib/prep';
import { useAppState } from '../state';

const FILTERS: [RecipeFilter, string][] = [
  ['all', 'All'],
  ['bowls', 'Bowls'],
  ['snacks', 'Snacks'],
  ['bed', 'Beds'],
  ['protein', 'Proteins'],
  ['veg', 'Veg'],
  ['sauce', 'Sauces'],
  ['topping', 'Toppings'],
];

const SORTS: [RecipeSort, string][] = [
  ['name', 'Name'],
  ['protein', 'Most protein'],
  ['kcal', 'Fewest kcal'],
  ['density', 'Protein per kcal'],
];

const kindLabel = (item: RecipeItem) =>
  item.kind === 'part' && item.role ? ROLE_TITLES[item.role].replace(/s$/, '') : item.kind === 'bowl' ? 'Bowl' : 'Snack';

export function Recipes() {
  const { data } = useAppState();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [sort, setSort] = useState<RecipeSort>('name');
  const items = useMemo(() => recipeItems(data.customMeals), [data.customMeals]);
  const shown = sortItems(filterItems(items, query, filter), sort);

  return (
    <>
      <header class="page-header">
        <h1>Recipes</h1>
      </header>

      <RandomBowl />

      <section class="group" aria-labelledby="browse-title">
        <h2 id="browse-title">Browse</h2>
        <input
          type="search"
          class="search"
          aria-label="Search recipes"
          placeholder="Search names and ingredients"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <fieldset class="field chips filter-chips">
          <legend class="visually-hidden">Show</legend>
          {FILTERS.map(([value, label]) => (
            <label key={value} class="chip">
              <input type="radio" name="recipe-filter" checked={filter === value} onChange={() => setFilter(value)} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <div class="field sort-field">
          <label for="recipe-sort">Sort by</label>
          <select id="recipe-sort" value={sort} onChange={(e) => setSort(e.currentTarget.value as RecipeSort)}>
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {shown.length === 0 ? (
          <p class="meta">No recipes match.</p>
        ) : (
          <ul class="recipe-list" aria-label="Recipes">
            {shown.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <a class="card recipe-row" href={item.href}>
                  <span class="recipe-name">{item.name}</span>
                  <span class="meta">
                    {`${kindLabel(item)} · ${formatKcal(item.nutrition.kcal)} · ${formatGrams(item.nutrition.protein)} protein`}
                  </span>
                  <span class="meta extras">{formatExtras(item.nutrition)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
