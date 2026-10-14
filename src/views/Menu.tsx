import { useState } from 'preact/hooks';
import { BowlEditor } from '../components/BowlEditor';
import { MenuStats } from '../components/MenuStats';
import { WeekHeader, useWeek } from '../components/WeekHeader';
import { PRESET_MEALS, SLOT_KIND, SLOT_LABELS, getPreset } from '../data/meals';
import type { Meal, MenuEntry, Slot, WeekMenu } from '../data/types';
import { formatExtras, formatGrams, formatKcal } from '../lib/format';
import { addEntry, entryDays, findMeal, householdMeals, newMealId, plannedDays, resolveEntries } from '../lib/menu';
import { randomWeek } from '../lib/random';
import { stableStringify } from '../lib/sync';
import { mealNutrition } from '../lib/nutrition';
import { hrefFor } from '../router';
import { useAppState } from '../state';

export function Menu({ week: routeWeek }: { week: number | null }) {
  const { data } = useAppState();
  const week = useWeek(routeWeek);

  return (
    <>
      <WeekHeader page="menu" title="Menu" week={week} />
      <MenuStats week={week} />
      <RandomizeWeek week={week} />
      {householdMeals(data.people).map((slot) => (
        <MenuSection key={slot} week={week} slot={slot} />
      ))}
      <p class="meta">
        Change who eats which meals in <a href={hrefFor({ name: 'settings' })}>Settings</a>. A new week starts with the
        previous week's menu.
      </p>
    </>
  );
}

const VARIATIONS = [2, 3, 4];

/** Replaces the week's menu with random picks, with an Undo until the menu changes again. */
function RandomizeWeek({ week }: { week: number }) {
  const { data, replaceWeekMenu } = useAppState();
  const [asking, setAsking] = useState(false);
  const [variations, setVariations] = useState(3);
  const [undo, setUndo] = useState<{ week: number; previous: WeekMenu | null; applied: string } | null>(null);
  const current = data.menus[week];
  const canUndo = undo !== null && undo.week === week && stableStringify(current ?? null) === undo.applied;

  const randomize = () => {
    const picks = randomWeek(householdMeals(data.people), data.customMeals, variations, Math.random);
    const menu: WeekMenu = { ...current, ...picks };
    setUndo({ week, previous: current ?? null, applied: stableStringify(menu) });
    replaceWeekMenu(week, menu);
    setAsking(false);
  };

  if (asking) {
    return (
      <div class="card confirm randomize" role="group" aria-labelledby="randomize-title">
        <p id="randomize-title">Replace this week's menu with random picks from the presets and your own bowls?</p>
        <fieldset class="field">
          <legend>Variations per meal</legend>
          <div class="segmented">
            {VARIATIONS.map((n) => (
              <label key={n}>
                <input type="radio" name="variations" checked={variations === n} onChange={() => setVariations(n)} />
                <span>{n}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div class="entry-actions">
          <button type="button" class="button-secondary" onClick={randomize}>
            Randomize
          </button>
          <button type="button" class="button-secondary" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="entry-actions randomize">
      <button type="button" class="button-secondary" onClick={() => setAsking(true)}>
        <span class="icon" aria-hidden="true">🎲</span>Randomize week
      </button>
      {canUndo && (
        <button
          type="button"
          class="button-link"
          onClick={() => {
            replaceWeekMenu(week, undo.previous);
            setUndo(null);
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

function MenuSection({ week, slot }: { week: number; slot: Slot }) {
  const { data, setMenu, saveCustomMeal } = useAppState();
  const entries = resolveEntries(data.menus, week, slot);
  const remaining = 7 - plannedDays(entries);
  const kind = SLOT_KIND[slot];
  const label = SLOT_LABELS[slot];
  const headingId = `menu-${slot}`;
  const eaters =
    data.people.length > 1
      ? ` · ${data.people
          .filter((p) => p.meals.includes(slot))
          .map((p) => p.name)
          .join(', ')}`
      : '';

  const canAdd = remaining > 0 || entries.some((e) => e.days > 1);
  const update = (next: MenuEntry[]) => setMenu(week, slot, next);
  const setDays = (index: number, days: number) =>
    update(entries.map((entry, i) => (i === index ? { ...entry, days } : entry)));
  const remove = (index: number) => update(entries.filter((_, i) => i !== index));

  // Editing a preset makes it your own bowl and points this week's entry at the copy.
  const edit = (index: number, meal: Meal) => {
    if (getPreset(meal.id)) {
      const preset = meal;
      return (changes: Partial<Meal>) => {
        const copy: Meal = { ...preset, name: `${preset.name} (custom)`, ...changes, id: newMealId() };
        saveCustomMeal(copy);
        update(entries.map((entry, i) => (i === index ? { ...entry, mealId: copy.id } : entry)));
      };
    }
    return (changes: Partial<Meal>) => saveCustomMeal({ ...meal, ...changes });
  };

  const options = [
    ...PRESET_MEALS.filter((m) => m.kind === kind),
    ...Object.values(data.customMeals).filter((m) => m.kind === kind),
  ];

  return (
    <section class="group" aria-labelledby={headingId}>
      <div class="title-row">
        <h2 id={headingId}>{label}</h2>
        <span class="meta">{`${7 - remaining} of 7 days${eaters}`}</span>
      </div>
      {remaining > 0 && <p class="warning">{`${remaining} ${remaining === 1 ? 'day' : 'days'} unplanned`}</p>}

      <ul class="entries">
        {entries.map((entry, index) => {
          const meal = findMeal(entry.mealId, data.customMeals);
          if (!meal) return null;
          return (
            <MenuItem
              key={index}
              meal={meal}
              entry={entry}
              range={entryDays(entries, index)}
              canGrow={remaining > 0}
              onDays={(days) => setDays(index, days)}
              onRemove={() => remove(index)}
              onEdit={edit(index, meal)}
            />
          );
        })}
      </ul>

      <label class="visually-hidden" for={`add-${slot}`}>{`Add to ${label.toLowerCase()}`}</label>
      <select
        id={`add-${slot}`}
        class="add-select"
        value=""
        disabled={!canAdd}
        onChange={(e) => {
          const mealId = e.currentTarget.value;
          e.currentTarget.value = '';
          if (mealId) update(addEntry(entries, mealId));
        }}
      >
        <option value="">{canAdd ? `+ Add a ${kind}` : 'Every day has its own item'}</option>
        {options.map((meal) => (
          <option key={meal.id} value={meal.id}>
            {meal.name}
          </option>
        ))}
      </select>
      {canAdd && remaining === 0 && (
        <p class="meta">Adding another takes a day from the item with the most days.</p>
      )}
    </section>
  );
}

interface ItemProps {
  meal: Meal;
  entry: MenuEntry;
  range: { from: number; to: number };
  canGrow: boolean;
  onDays(days: number): void;
  onRemove(): void;
  onEdit(changes: Partial<Meal>): void;
}

function MenuItem({ meal, entry, range, canGrow, onDays, onRemove, onEdit }: ItemProps) {
  const [open, setOpen] = useState(false);
  const nutrition = mealNutrition(meal);
  const days = range.from === range.to ? `Day ${range.from}` : `Days ${range.from}–${range.to}`;

  return (
    <li class="card entry">
      <div class="entry-head">
        <div class="entry-body">
          <h3 class="entry-name">{meal.name}</h3>
          <p class="meta">{`${days} · ${formatKcal(nutrition.kcal)} · ${formatGrams(nutrition.protein)} protein`}</p>
          <p class="meta extras">{formatExtras(nutrition)}</p>
        </div>
        <div class="stepper" role="group" aria-label={`Days of ${meal.name}`}>
          <button
            type="button"
            aria-label={`Fewer days of ${meal.name}`}
            disabled={entry.days <= 1}
            onClick={() => onDays(entry.days - 1)}
          >
            −
          </button>
          <output aria-live="polite">{entry.days}</output>
          <button
            type="button"
            aria-label={`More days of ${meal.name}`}
            disabled={!canGrow}
            onClick={() => onDays(entry.days + 1)}
          >
            +
          </button>
        </div>
      </div>
      <div class="entry-actions">
        {meal.kind === 'bowl' && (
          <button type="button" class="button-link" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Done swapping' : 'Swap ingredients'}
          </button>
        )}
        <button type="button" class="button-link" onClick={onRemove} aria-label={`Remove ${meal.name}`}>
          Remove
        </button>
      </div>
      {open && <BowlEditor meal={meal} onEdit={onEdit} />}
    </li>
  );
}
