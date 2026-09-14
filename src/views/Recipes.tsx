import { RECIPE_LIST } from '../data/recipes';
import type { RecipeKind } from '../data/types';
import { formatGrams, formatKcal } from '../lib/format';
import { recipeNutrition } from '../lib/nutrition';
import { hrefFor } from '../router';

const GROUPS: { kind: RecipeKind; title: string; blurb: string }[] = [
  { kind: 'master', title: 'Master recipes', blurb: 'The four core recipes from the brief.' },
  { kind: 'meal', title: 'Plan meals', blurb: "The plan's other meals, built from the brief's meal descriptions." },
  { kind: 'sauce', title: 'Sauces', blurb: 'Low-calorie flavor agents. Only counted in totals when part of a meal.' },
];

export function Recipes() {
  return (
    <>
      <header class="page-header">
        <h1>Recipes</h1>
      </header>

      {GROUPS.map((group) => (
        <section key={group.kind} class="group" aria-labelledby={`group-${group.kind}`}>
          <h2 id={`group-${group.kind}`}>{group.title}</h2>
          <p class="meta">{group.blurb}</p>
          <ul class="card list">
            {RECIPE_LIST.filter((recipe) => recipe.kind === group.kind).map((recipe) => {
              const nutrition = recipeNutrition(recipe.id);
              return (
                <li key={recipe.id}>
                  <a class="list-link" href={hrefFor({ name: 'recipe', id: recipe.id })}>
                    <span class="list-title">{recipe.name}</span>
                    <span class="meta">
                      {`${formatKcal(nutrition.kcal)} · ${formatGrams(nutrition.protein)} protein`}
                      {recipe.source === 'derived' ? ' · derived' : ''}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
