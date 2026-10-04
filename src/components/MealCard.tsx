import { COMPONENTS } from '../data/components';
import { SLOT_LABELS } from '../data/meals';
import { formatGrams, formatKcal, formatQuantity } from '../lib/format';
import { formatPortion } from '../lib/prep';
import type { ScaledMeal } from '../lib/scaling';
import { hrefFor } from '../router';

interface Props {
  scaled: ScaledMeal;
  eaten: boolean;
  disabled: boolean;
  onToggle(): void;
}

export function MealCard({ scaled, eaten, disabled, onToggle }: Props) {
  const { slot, meal, servings, nutrition } = scaled;
  return (
    <article class={`card meal${eaten ? ' is-eaten' : ''}`}>
      <div class="meal-body">
        <p class="eyebrow">{SLOT_LABELS[slot]}</p>
        <h2 class="meal-name">{meal.name}</h2>
        <p class="meta">{`${formatKcal(nutrition.kcal)} · ${formatGrams(nutrition.protein)} protein`}</p>
        <ul class="parts">
          {meal.parts.map((id) => {
            const component = COMPONENTS[id];
            const times = servings[id];
            return (
              <li key={id}>
                <a href={hrefFor({ name: 'component', id })}>{component.name}</a>
                <span class="meta">
                  {` ${formatPortion(component.portion, times)}`}
                  {times !== 1 && <span class="scaled">{` ×${formatQuantity(times)}`}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <button
        type="button"
        class="eat-toggle"
        aria-label={`${meal.name} eaten`}
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
