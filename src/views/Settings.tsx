import { useEffect, useState } from 'preact/hooks';
import { CloudSyncCard } from '../components/CloudSyncCard';
import { SLOT_KIND, SLOT_LABELS } from '../data/meals';
import { SLOTS, type Slot } from '../data/types';
import { formatNumber } from '../lib/format';
import { isIsoDate } from '../lib/program';
import { MAINTENANCE_RANGE, MAX_PEOPLE, isValidMaintenance, type Person } from '../lib/storage';
import {
  KCAL_MAX,
  KCAL_MIN,
  WEIGHT_RANGE,
  convertWeight,
  isValidWeight,
  proteinTarget,
  type WeightUnit,
} from '../lib/targets';
import { useAppState } from '../state';

const UNITS: WeightUnit[] = ['lb', 'kg'];

const parseWeight = (value: string): number | null => (value.trim() === '' ? null : Number(value));

export function Settings() {
  const { data, persistent, sync, setSettings, updatePerson, addPerson } = useAppState();
  const { settings, people } = data;

  // A cleared or half-typed date comes through as "" or an invalid date; keep the saved one until it's valid.
  const onDateChange = (value: string) => {
    if (isIsoDate(value)) setSettings({ startDate: value });
  };

  const onUnitChange = (unit: WeightUnit) => {
    if (unit === settings.unit) return;
    for (const person of people) {
      if (person.targetWeight !== null) {
        updatePerson(person.id, { targetWeight: convertWeight(person.targetWeight, settings.unit, unit) });
      }
    }
    setSettings({ unit });
  };

  return (
    <>
      <header class="page-header">
        <h1>Settings</h1>
      </header>

      {!persistent && <p class="notice">Progress won't be saved in this browser.</p>}

      <section class="card form" aria-labelledby="program-title">
        <h2 id="program-title">Program</h2>
        <div class="field">
          <label for="start-date">Start date</label>
          <input
            id="start-date"
            type="date"
            value={settings.startDate}
            onInput={(e) => onDateChange(e.currentTarget.value)}
            onChange={(e) => onDateChange(e.currentTarget.value)}
          />
          <p class="meta">Day 1 of week 1. Each program week has its own menu, prep list and shopping list.</p>
        </div>
        <fieldset class="field unit-field">
          <legend>Weight unit</legend>
          <div class="segmented">
            {UNITS.map((unit) => (
              <label key={unit}>
                <input
                  type="radio"
                  name="unit"
                  value={unit}
                  checked={settings.unit === unit}
                  onChange={() => onUnitChange(unit)}
                />
                <span>{unit}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <CloudSyncCard />

      <section class="group" aria-labelledby="people-title">
        <h2 id="people-title">People</h2>
        <p class="meta">
          Everyone shares the week's menu. Portions scale to each person's target, and Prep and Shopping add everyone
          up.
        </p>
        {people.map((person, index) => (
          <PersonEditor key={person.id} person={person} index={index} />
        ))}
        <button
          type="button"
          class="button-secondary"
          onClick={addPerson}
          disabled={people.length >= MAX_PEOPLE}
        >
          Add person
        </button>
      </section>

      <section class="card" aria-labelledby="about-title">
        <h2 id="about-title">About the numbers</h2>
        <p class="meta">
          {`Daily calorie range: ${formatNumber(KCAL_MIN)}–${formatNumber(KCAL_MAX)} kcal. Bowl proteins grow first, then beds, in half portions until the day reaches the person's targets, without going over ${formatNumber(KCAL_MAX)} kcal. Calories and protein are estimated from approximate USDA values and will differ from your product labels. A new day starts at 4am, so late-night eating counts toward the evening before. ${sync.status === 'off' ? 'Everything you save stays in this browser.' : 'Everything you save stays in this browser, and in your own iCloud when you sign in.'}`}
        </p>
      </section>
    </>
  );
}

function PersonEditor({ person, index }: { person: Person; index: number }) {
  const { data, updatePerson, removePerson } = useAppState();
  const { unit } = data.settings;
  const [name, setName] = useState(person.name);
  const [weightDraft, setWeightDraft] = useState(person.targetWeight?.toString() ?? '');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [maintenanceDraft, setMaintenanceDraft] = useState(person.maintenance?.toString() ?? '');
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const id = `person-${index}`;
  const range = WEIGHT_RANGE[unit];
  const target = proteinTarget(person.targetWeight, unit);
  const canRemove = data.people.length > 1;

  // Switching units converts the saved weight; show the converted value.
  useEffect(() => {
    setWeightDraft(person.targetWeight?.toString() ?? '');
    setWeightError(null);
  }, [unit]);

  // Save as soon as the value is valid, but only complain once the field loses focus.
  const onWeightInput = (input: HTMLInputElement) => {
    setWeightDraft(input.value);
    // Text the browser can't parse (e.g. "72,5") reads as "" with badInput set; that isn't clearing the field.
    if (input.validity.badInput) return;
    const weight = parseWeight(input.value);
    if (weight === null || isValidWeight(weight, unit)) {
      updatePerson(person.id, { targetWeight: weight });
      setWeightError(null);
    }
  };

  const onWeightBlur = (input: HTMLInputElement) => {
    const weight = parseWeight(input.value);
    if (input.validity.badInput || (weight !== null && !isValidWeight(weight, unit))) {
      setWeightError(`Enter a weight between ${range.min} and ${range.max} ${unit}.`);
    }
  };

  const onMaintenanceInput = (input: HTMLInputElement) => {
    setMaintenanceDraft(input.value);
    if (input.validity.badInput) return;
    const kcal = parseWeight(input.value);
    if (kcal === null || isValidMaintenance(kcal)) {
      updatePerson(person.id, { maintenance: kcal });
      setMaintenanceError(null);
    }
  };

  const onMaintenanceBlur = (input: HTMLInputElement) => {
    const kcal = parseWeight(input.value);
    if (input.validity.badInput || (kcal !== null && !isValidMaintenance(kcal))) {
      setMaintenanceError(
        `Enter between ${formatNumber(MAINTENANCE_RANGE.min)} and ${formatNumber(MAINTENANCE_RANGE.max)} kcal a day.`,
      );
    }
  };

  const onMealToggle = (slot: Slot) => {
    const meals = person.meals.includes(slot)
      ? person.meals.filter((s) => s !== slot)
      : SLOTS.filter((s) => s === slot || person.meals.includes(s));
    if (meals.length > 0) updatePerson(person.id, { meals });
  };

  return (
    <article class="card form person" aria-label={person.name}>
      <div class="field">
        <label for={`${id}-name`}>Name</label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          onInput={(e) => {
            setName(e.currentTarget.value);
            if (e.currentTarget.value.trim()) updatePerson(person.id, { name: e.currentTarget.value.trim() });
          }}
          onBlur={() => setName(person.name)}
        />
      </div>

      <div class="field">
        <label for={`${id}-weight`}>Target weight</label>
        <div class="input-row">
          <input
            id={`${id}-weight`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={range.min}
            max={range.max}
            placeholder={unit === 'lb' ? 'e.g. 160' : 'e.g. 72'}
            value={weightDraft}
            aria-invalid={weightError ? 'true' : undefined}
            onInput={(e) => onWeightInput(e.currentTarget)}
            onBlur={(e) => onWeightBlur(e.currentTarget)}
          />
          <span class="unit-suffix">{unit}</span>
        </div>
        {weightError && (
          <p class="error" role="alert">
            {weightError}
          </p>
        )}
        <p class="meta">
          {target
            ? `${formatNumber(target.min)}–${formatNumber(target.max)} g protein per day`
            : 'The brief targets 0.8–1.0 g of protein per pound of target body weight.'}
        </p>
      </div>

      <div class="field">
        <label for={`${id}-maintenance`}>Maintenance calories</label>
        <div class="input-row">
          <input
            id={`${id}-maintenance`}
            type="number"
            inputMode="numeric"
            step="10"
            min={MAINTENANCE_RANGE.min}
            max={MAINTENANCE_RANGE.max}
            placeholder="e.g. 2200"
            value={maintenanceDraft}
            aria-invalid={maintenanceError ? 'true' : undefined}
            onInput={(e) => onMaintenanceInput(e.currentTarget)}
            onBlur={(e) => onMaintenanceBlur(e.currentTarget)}
          />
          <span class="unit-suffix">kcal/day</span>
        </div>
        {maintenanceError && (
          <p class="error" role="alert">
            {maintenanceError}
          </p>
        )}
        <p class="meta">What this person burns in a day. Use a TDEE calculator; the Menu shows the deficit.</p>
      </div>

      <fieldset class="field meal-choices">
        <legend>Meals</legend>
        {SLOTS.map((slot) => {
          const on = person.meals.includes(slot);
          return (
            <label key={slot} class="check">
              <input
                type="checkbox"
                checked={on}
                disabled={on && person.meals.length === 1}
                onChange={() => onMealToggle(slot)}
              />
              <span class="check-text">
                <span>{SLOT_LABELS[slot]}</span>
                <span class="meta">{SLOT_KIND[slot] === 'bowl' ? 'A bowl' : 'A snack'}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <label class="check scale-toggle">
        <input
          type="checkbox"
          checked={person.scale}
          onChange={() => updatePerson(person.id, { scale: !person.scale })}
        />
        <span class="check-text">
          <span>Scale portions to targets</span>
          <span class="meta">
            {person.scale
              ? 'Proteins, then beds, grow until the day reaches the targets.'
              : 'One base portion of everything. Good for someone who also eats outside the plan.'}
          </span>
        </span>
      </label>

      {canRemove &&
        (confirming ? (
          <div class="confirm" role="group" aria-label={`Remove ${person.name}?`}>
            <p>{`Remove ${person.name} and their eaten history?`}</p>
            <div class="entry-actions">
              <button type="button" class="button-secondary danger" onClick={() => removePerson(person.id)}>
                {`Remove ${person.name}`}
              </button>
              <button type="button" class="button-secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" class="button-link" onClick={() => setConfirming(true)}>
            {`Remove ${person.name}…`}
          </button>
        ))}
    </article>
  );
}
