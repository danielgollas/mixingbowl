import { RECIPES, getRecipe } from '../data/recipes';
import type { Method, RecipeKind } from '../data/types';
import { formatNumber } from '../lib/format';
import { recipeNutrition } from '../lib/nutrition';
import { hrefFor } from '../router';

const METHOD_LABELS: Record<Method, string> = {
  'air-fryer': 'Air fryer',
  stovetop: 'Stovetop',
  blender: 'Blender',
  oven: 'Oven',
  'no-cook': 'No-cook',
};

const KIND_LABELS: Record<RecipeKind, string> = {
  master: 'Master recipe',
  meal: 'Plan meal',
  sauce: 'Sauce',
};

export function RecipeDetail({ id }: { id: string }) {
  const recipe = getRecipe(id);

  if (!recipe) {
    return (
      <>
        <header class="page-header">
          <h1>Recipe not found</h1>
        </header>
        <p>
          <a href={hrefFor({ name: 'recipes' })}>Back to all recipes</a>
        </p>
      </>
    );
  }

  const nutrition = recipeNutrition(id);
  const briefDiffers = recipe.briefKcal !== undefined && Math.round(nutrition.kcal) !== recipe.briefKcal;

  return (
    <>
      <header class="page-header">
        <a class="back-link" href={hrefFor({ name: 'recipes' })}>
          All recipes
        </a>
        <p class="eyebrow">{KIND_LABELS[recipe.kind]}</p>
        <h1>{recipe.name}</h1>
        <div class="badges">
          {recipe.methods.map((method) => (
            <span key={method} class="badge">
              {METHOD_LABELS[method]}
            </span>
          ))}
          {recipe.source === 'derived' && <span class="badge badge-derived">Derived from brief</span>}
        </div>
      </header>

      <section class="card stats" aria-label="Nutrition estimate">
        <div>
          <span class="stat-value">{formatNumber(nutrition.kcal)}</span>
          <span class="stat-label">kcal</span>
        </div>
        <div>
          <span class="stat-value">{`${formatNumber(nutrition.protein)} g`}</span>
          <span class="stat-label">protein</span>
        </div>
        {briefDiffers && (
          <p class="meta stats-note">
            {`Brief lists ~${recipe.briefKcal} kcal; this estimate is calculated from the ingredients.`}
          </p>
        )}
      </section>

      <section class="card" aria-labelledby="ingredients-title">
        <h2 id="ingredients-title">Ingredients</h2>
        <ul class="ingredients">
          {recipe.components.map((component) => (
            <li key={component.recipeId}>
              <a href={hrefFor({ name: 'recipe', id: component.recipeId })}>{RECIPES[component.recipeId].name}</a>
              {component.servings !== 1 ? ` × ${component.servings}` : ''}
            </li>
          ))}
          {recipe.ingredients.map((ingredient, index) => (
            <li key={index}>{ingredient.amount}</li>
          ))}
        </ul>
      </section>

      <section class="card" aria-labelledby="method-title">
        <h2 id="method-title">Method</h2>
        <ol class="steps">
          {recipe.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>
    </>
  );
}
