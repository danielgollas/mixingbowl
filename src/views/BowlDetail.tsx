import { useState } from 'preact/hooks';
import { BowlEditor } from '../components/BowlEditor';
import { useWeek } from '../components/WeekHeader';
import { getComponent } from '../data/components';
import { SLOT_KIND, SLOT_LABELS, getPreset } from '../data/meals';
import { SLOTS, type Slot } from '../data/types';
import { formatNumber } from '../lib/format';
import { addEntry, findMeal, resolveEntries } from '../lib/menu';
import { mealNutrition } from '../lib/nutrition';
import { ROLE_TITLES } from '../lib/prep';
import { goBack, hrefFor } from '../router';
import { menusUsing, useAppState } from '../state';

export function BowlDetail({ id }: { id: string }) {
  const { data, setMenu, saveCustomMeal, deleteCustomMeal } = useAppState();
  const meal = findMeal(id, data.customMeals);
  const currentWeek = useWeek(null);
  const slots = SLOTS.filter((slot) => meal && SLOT_KIND[slot] === meal.kind);
  const [slot, setSlot] = useState<Slot>(slots.find((s) => s === 'dinner' || s === 'snack') ?? slots[0]);
  const [weekDraft, setWeekDraft] = useState(String(currentWeek));
  const [added, setAdded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!meal) {
    return (
      <>
        <header class="page-header">
          <h1>Recipe not found</h1>
        </header>
        <p>
          <a href={hrefFor({ name: 'recipes' })}>Browse recipes</a>
        </p>
      </>
    );
  }

  const nutrition = mealNutrition(meal);
  const own = !getPreset(meal.id);
  const usedIn = own ? menusUsing(data, meal.id) : [];
  const week = Number(weekDraft);
  const validWeek = Number.isInteger(week) && week >= 1 && week <= 9999;

  const addToMenu = () => {
    if (!validWeek) return;
    setMenu(week, slot, addEntry(resolveEntries(data.menus, week, slot), meal.id));
    setAdded(`Added to ${SLOT_LABELS[slot].toLowerCase()} in week ${week}.`);
  };

  return (
    <>
      <header class="page-header">
        <a class="back-link" href={hrefFor({ name: 'recipes' })} onClick={goBack}>
          Back
        </a>
        <p class="eyebrow">{`${meal.kind === 'bowl' ? 'Bowl' : 'Snack'}${own ? ' · Your own' : ''}`}</p>
        <h1>{meal.name}</h1>
      </header>

      <section class="card stats" aria-label="Nutrition estimate">
        <div>
          <span class="stat-value">{formatNumber(nutrition.kcal)}</span>
          <span class="stat-label">kcal</span>
        </div>
        {(
          [
            ['protein', nutrition.protein],
            ['fat', nutrition.fat],
            ['fiber', nutrition.fiber],
            ['sugars', nutrition.sugar],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <span class="stat-value">{`${formatNumber(value)} g`}</span>
            <span class="stat-label">{label}</span>
          </div>
        ))}
        <p class="meta stats-note">One base portion of each part, before scaling.</p>
      </section>

      <section class="card" aria-labelledby="parts-title">
        <h2 id="parts-title">Parts</h2>
        <ul class="ingredients" aria-labelledby="parts-title">
          {meal.parts.map((partId) => {
            const part = getComponent(partId);
            return (
              <li key={partId}>
                <a href={hrefFor({ name: 'component', id: partId })}>{part?.name ?? partId}</a>
                {part && <span class="meta">{` · ${ROLE_TITLES[part.role].replace(/s$/, '')}`}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section class="card form" aria-labelledby="add-title">
        <h2 id="add-title">Add to menu</h2>
        <div class="field">
          <label for="add-meal">Meal</label>
          <select id="add-meal" value={slot} onChange={(e) => setSlot(e.currentTarget.value as Slot)}>
            {slots.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <label for="add-week">Week</label>
          <input
            id="add-week"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={weekDraft}
            aria-invalid={validWeek ? undefined : 'true'}
            onInput={(e) => setWeekDraft(e.currentTarget.value)}
          />
          <p class="meta">{`This is week ${currentWeek}. A full week gives it one day from the item with the most days.`}</p>
        </div>
        <button type="button" class="button-secondary" disabled={!validWeek} onClick={addToMenu}>
          Add to menu
        </button>
        {added && <p role="status">{added}</p>}
      </section>

      {own && meal.kind === 'bowl' && (
        <section class="card" aria-labelledby="edit-title">
          <h2 id="edit-title">Change ingredients</h2>
          <BowlEditor meal={meal} onEdit={(changes) => saveCustomMeal({ ...meal, ...changes })} />
        </section>
      )}

      {own &&
        (usedIn.length > 0 ? (
          <p class="meta">
            {`Used in the week ${usedIn.join(', ')} menu${usedIn.length > 1 ? 's' : ''}. Remove it there to delete it.`}
          </p>
        ) : confirming ? (
          <div class="confirm" role="group" aria-label={`Delete ${meal.name}?`}>
            <p>{`Delete ${meal.name}? This can't be undone.`}</p>
            <div class="entry-actions">
              <button
                type="button"
                class="button-secondary danger"
                onClick={() => {
                  deleteCustomMeal(meal.id);
                  location.hash = hrefFor({ name: 'recipes' });
                }}
              >
                {`Delete ${meal.name}`}
              </button>
              <button type="button" class="button-secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" class="button-link" onClick={() => setConfirming(true)}>
            {`Delete ${meal.name}…`}
          </button>
        ))}
    </>
  );
}
