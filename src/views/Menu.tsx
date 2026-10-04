import { useEffect, useState } from 'preact/hooks';
import { WeekHeader, useWeek } from '../components/WeekHeader';
import { COMPONENT_LIST } from '../data/components';
import { PRESET_MEALS, SLOT_KIND, SLOT_LABELS, getPreset, partsWithRole } from '../data/meals';
import type { ComponentId, Meal, MenuEntry, Role, Slot } from '../data/types';
import { formatGrams, formatKcal } from '../lib/format';
import { entryDays, findMeal, plannedDays, resolveEntries } from '../lib/menu';
import { mealNutrition } from '../lib/nutrition';
import { hrefFor } from '../router';
import { useAppState } from '../state';

const BOWL_ORDER: Role[] = ['bed', 'protein', 'veg', 'sauce', 'topping'];

const newMealId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function Menu({ week: routeWeek }: { week: number | null }) {
  const { data } = useAppState();
  const week = useWeek(routeWeek);

  return (
    <>
      <WeekHeader page="menu" title="Menu" week={week} />
      {data.settings.meals.map((slot) => (
        <MenuSection key={slot} week={week} slot={slot} />
      ))}
      <p class="meta">
        Change which meals you eat in <a href={hrefFor({ name: 'settings' })}>Settings</a>. A new week starts with the
        previous week's menu.
      </p>
    </>
  );
}

function MenuSection({ week, slot }: { week: number; slot: Slot }) {
  const { data, setMenu, saveCustomMeal } = useAppState();
  const entries = resolveEntries(data.menus, week, slot);
  const remaining = 7 - plannedDays(entries);
  const kind = SLOT_KIND[slot];
  const label = SLOT_LABELS[slot];
  const headingId = `menu-${slot}`;

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
        <span class="meta">{`${7 - remaining} of 7 days`}</span>
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
        disabled={remaining === 0}
        onChange={(e) => {
          const mealId = e.currentTarget.value;
          e.currentTarget.value = '';
          if (mealId) update([...entries, { mealId, days: remaining }]);
        }}
      >
        <option value="">{remaining === 0 ? 'All 7 days planned' : `+ Add a ${kind}`}</option>
        {options.map((meal) => (
          <option key={meal.id} value={meal.id}>
            {meal.name}
          </option>
        ))}
      </select>
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

const optionsFor = (role: Role) => COMPONENT_LIST.filter((c) => c.role === role);

function BowlEditor({ meal, onEdit }: { meal: Meal; onEdit(changes: Partial<Meal>): void }) {
  const [name, setName] = useState(meal.name);
  // The first edit to a preset swaps in a copy with a new id and name.
  useEffect(() => setName(meal.name), [meal.id]);
  const idBase = `edit-${meal.id}`;

  const setRole = (role: Role, ids: ComponentId[]) =>
    onEdit({ parts: BOWL_ORDER.flatMap((r) => (r === role ? ids : partsWithRole(meal, r))) });

  const single = (role: Role, label: string, optional: boolean) => (
    <div class="field">
      <label for={`${idBase}-${role}`}>{label}</label>
      <select
        id={`${idBase}-${role}`}
        value={partsWithRole(meal, role)[0] ?? ''}
        onChange={(e) => setRole(role, e.currentTarget.value ? [e.currentTarget.value] : [])}
      >
        {optional && <option value="">None</option>}
        {optionsFor(role).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );

  const veg = new Set(partsWithRole(meal, 'veg'));

  return (
    <div class="editor">
      <div class="field">
        <label for={`${idBase}-name`}>Name</label>
        <input
          id={`${idBase}-name`}
          type="text"
          value={name}
          onInput={(e) => {
            const value = e.currentTarget.value;
            setName(value);
            if (value.trim()) onEdit({ name: value.trim() });
          }}
        />
      </div>
      {single('bed', 'Bed', false)}
      {single('protein', 'Protein', false)}
      <fieldset class="field chips">
        <legend>Veg</legend>
        {optionsFor('veg').map((c) => (
          <label key={c.id} class="chip">
            <input
              type="checkbox"
              checked={veg.has(c.id)}
              onChange={() =>
                setRole(
                  'veg',
                  optionsFor('veg')
                    .map((v) => v.id)
                    .filter((id) => (id === c.id ? !veg.has(id) : veg.has(id))),
                )
              }
            />
            <span>{c.name}</span>
          </label>
        ))}
      </fieldset>
      {single('sauce', 'Sauce', true)}
      {single('topping', 'Topping', true)}
      <p class="meta">
        {getPreset(meal.id)
          ? 'Changing anything saves this as your own bowl for this week. The preset stays as it is.'
          : "Your own bowl. Changes apply everywhere it's used."}
      </p>
    </div>
  );
}
