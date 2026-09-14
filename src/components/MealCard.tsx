import { SLOT_LABELS } from '../data/plan';
import { RECIPES } from '../data/recipes';
import type { RecipeId, Slot } from '../data/types';
import { formatGrams, formatKcal } from '../lib/format';
import { recipeNutrition } from '../lib/nutrition';
import { hrefFor } from '../router';

interface Props {
  slot: Slot;
  recipeId: RecipeId;
  eaten: boolean;
  disabled: boolean;
  onToggle(): void;
}

export function MealCard({ slot, recipeId, eaten, disabled, onToggle }: Props) {
  const recipe = RECIPES[recipeId];
  const nutrition = recipeNutrition(recipeId);
  return (
    <article class={`card meal${eaten ? ' is-eaten' : ''}`}>
      <div class="meal-body">
        <p class="eyebrow">{SLOT_LABELS[slot]}</p>
        <h2 class="meal-name">
          <a href={hrefFor({ name: 'recipe', id: recipeId })}>{recipe.name}</a>
        </h2>
        <p class="meta">{`${formatKcal(nutrition.kcal)} · ${formatGrams(nutrition.protein)} protein`}</p>
      </div>
      <button
        type="button"
        class="eat-toggle"
        aria-label={`${recipe.name} eaten`}
        aria-pressed={eaten}
        disabled={disabled}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5 9.5 17 19 7.5" />
        </svg>
      </button>
    </article>
  );
}
