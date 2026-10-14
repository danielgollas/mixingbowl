import { useState } from 'preact/hooks';
import { getComponent } from '../data/components';
import type { Role } from '../data/types';
import { formatExtras, formatGrams, formatKcal } from '../lib/format';
import { newMealId } from '../lib/menu';
import { mealNutrition } from '../lib/nutrition';
import { ROLL_ROLES, bowlName, rerollPart, rollBowl, type Locks } from '../lib/random';
import { hrefFor } from '../router';
import { useAppState } from '../state';

const LABELS: Record<(typeof ROLL_ROLES)[number], string> = {
  bed: 'Bed',
  protein: 'Protein',
  veg: 'Veg',
  sauce: 'Sauce',
  topping: 'Topping',
};

/** Rolls a fully random bowl; lock parts you like, re-roll the rest, and save it as your own. */
export function RandomBowl() {
  const { saveCustomMeal } = useAppState();
  const [parts, setParts] = useState(() => rollBowl(null, {}, Math.random));
  const [locks, setLocks] = useState<Locks>({});
  const nutrition = mealNutrition({ id: 'roll', name: 'Roll', kind: 'bowl', parts });

  const save = () => {
    const meal = { id: newMealId(), name: bowlName(parts), kind: 'bowl' as const, parts };
    saveCustomMeal(meal);
    location.hash = hrefFor({ name: 'bowl', id: meal.id });
  };

  return (
    <section class="card random-bowl" aria-labelledby="random-title">
      <h2 id="random-title">Random bowl</h2>
      <p class="meta">{`${formatKcal(nutrition.kcal)} · ${formatGrams(nutrition.protein)} protein · ${formatExtras(nutrition)}`}</p>
      <ul class="roll">
        {ROLL_ROLES.map((role: Role) => {
          const ids = parts.filter((id) => getComponent(id)?.role === role);
          const label = LABELS[role as keyof typeof LABELS];
          return (
            <li key={role} class="roll-row">
              <span class="roll-role">{label}</span>
              <span class="roll-parts" data-testid={`roll-${role}`}>
                {ids.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <a href={hrefFor({ name: 'component', id })}>{getComponent(id)?.name}</a>
                  </span>
                ))}
              </span>
              <label class="lock" title="Keep on Roll again">
                <input
                  type="checkbox"
                  aria-label={`Keep ${label.toLowerCase()}`}
                  checked={!!locks[role]}
                  onChange={() => setLocks({ ...locks, [role]: !locks[role] })}
                />
                <span aria-hidden="true">{locks[role] ? '🔒' : '🔓'}</span>
              </label>
              <button
                type="button"
                class="dice"
                aria-label={`Random ${label.toLowerCase()}`}
                title="Random"
                onClick={() => setParts(rerollPart(parts, role, Math.random))}
              >
                🎲
              </button>
            </li>
          );
        })}
      </ul>
      <div class="entry-actions">
        <button type="button" class="button-secondary" onClick={() => setParts(rollBowl(parts, locks, Math.random))}>
          Roll again
        </button>
        <button type="button" class="button-secondary" onClick={save}>
          Save bowl
        </button>
      </div>
    </section>
  );
}
