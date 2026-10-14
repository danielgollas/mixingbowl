import { useEffect, useState } from 'preact/hooks';
import { COMPONENT_LIST } from '../data/components';
import { getPreset, partsWithRole } from '../data/meals';
import type { ComponentId, Meal, Role } from '../data/types';
import { ROLL_ROLES, rerollPart } from '../lib/random';

const optionsFor = (role: Role) => COMPONENT_LIST.filter((c) => c.role === role);

export function BowlEditor({ meal, onEdit }: { meal: Meal; onEdit(changes: Partial<Meal>): void }) {
  const [name, setName] = useState(meal.name);
  // The first edit to a preset swaps in a copy with a new id and name.
  useEffect(() => setName(meal.name), [meal.id]);
  const idBase = `edit-${meal.id}`;

  const setRole = (role: Role, ids: ComponentId[]) =>
    onEdit({ parts: ROLL_ROLES.flatMap((r) => (r === role ? ids : partsWithRole(meal, r))) });
  const reroll = (role: Role) => onEdit({ parts: rerollPart(meal.parts, role, Math.random) });

  const single = (role: Role, label: string, optional: boolean) => (
    <div class="field">
      <label for={`${idBase}-${role}`}>{label}</label>
      <div class="input-row">
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
        <button
          type="button"
          class="dice"
          aria-label={`Random ${label.toLowerCase()}`}
          title="Random"
          onClick={() => reroll(role)}
        >
          🎲
        </button>
      </div>
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
        <button type="button" class="button-link chips-action" onClick={() => reroll('veg')}>
          <span class="icon" aria-hidden="true">🎲</span>Random veg
        </button>
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
