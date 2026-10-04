import { useState } from 'preact/hooks';
import { SLOT_KIND, SLOT_LABELS } from '../data/meals';
import { SLOTS, type Slot } from '../data/types';
import { formatNumber } from '../lib/format';
import { isIsoDate } from '../lib/program';
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
  const { data, persistent, setSettings } = useAppState();
  const { settings } = data;
  const [weightDraft, setWeightDraft] = useState(settings.targetWeight?.toString() ?? '');
  const [weightError, setWeightError] = useState<string | null>(null);

  const range = WEIGHT_RANGE[settings.unit];
  const target = proteinTarget(settings.targetWeight, settings.unit);

  // A cleared or half-typed date comes through as "" or an invalid date; keep the saved one until it's valid.
  const onDateChange = (value: string) => {
    if (isIsoDate(value)) setSettings({ startDate: value });
  };

  // Save as soon as the value is valid, but only complain once the field loses focus.
  const onWeightInput = (input: HTMLInputElement) => {
    setWeightDraft(input.value);
    // Text the browser can't parse (e.g. "72,5") reads as "" with badInput set; that isn't clearing the field.
    if (input.validity.badInput) return;
    const weight = parseWeight(input.value);
    if (weight === null || isValidWeight(weight, settings.unit)) {
      setSettings({ targetWeight: weight });
      setWeightError(null);
    }
  };

  const onWeightBlur = (input: HTMLInputElement) => {
    const weight = parseWeight(input.value);
    if (input.validity.badInput || (weight !== null && !isValidWeight(weight, settings.unit))) {
      setWeightError(`Enter a weight between ${range.min} and ${range.max} ${settings.unit}.`);
    }
  };

  const onMealToggle = (slot: Slot) => {
    const meals = settings.meals.includes(slot)
      ? settings.meals.filter((s) => s !== slot)
      : SLOTS.filter((s) => s === slot || settings.meals.includes(s));
    if (meals.length > 0) setSettings({ meals });
  };

  const onUnitChange = (unit: WeightUnit) => {
    if (unit === settings.unit) return;
    const targetWeight =
      settings.targetWeight === null ? null : convertWeight(settings.targetWeight, settings.unit, unit);
    setSettings({ unit, targetWeight });
    setWeightDraft(targetWeight?.toString() ?? '');
    setWeightError(null);
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
      </section>

      <section class="card form" aria-labelledby="meals-title">
        <h2 id="meals-title">Meals you eat</h2>
        <fieldset class="field meal-choices">
          <legend class="visually-hidden">Meals you eat</legend>
          {SLOTS.map((slot) => {
            const on = settings.meals.includes(slot);
            return (
              <label key={slot} class="check">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={on && settings.meals.length === 1}
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
      </section>

      <section class="card form" aria-labelledby="target-title">
        <h2 id="target-title">Protein target</h2>
        <div class="field">
          <label for="target-weight">Target weight</label>
          <div class="input-row">
            <input
              id="target-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={range.min}
              max={range.max}
              placeholder={settings.unit === 'lb' ? 'e.g. 160' : 'e.g. 72'}
              value={weightDraft}
              aria-invalid={weightError ? 'true' : undefined}
              onInput={(e) => onWeightInput(e.currentTarget)}
              onBlur={(e) => onWeightBlur(e.currentTarget)}
            />
            <fieldset class="segmented">
              <legend class="visually-hidden">Unit</legend>
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
            </fieldset>
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
      </section>

      <section class="card" aria-labelledby="about-title">
        <h2 id="about-title">About the numbers</h2>
        <p class="meta">
          {`Daily calorie range: ${formatNumber(KCAL_MIN)}–${formatNumber(KCAL_MAX)} kcal. Bowl proteins grow first, then beds, in half portions until the day reaches your targets, without going over ${formatNumber(KCAL_MAX)} kcal. Calories and protein are estimated from approximate USDA values and will differ from your product labels. A new day starts at 4am, so late-night eating counts toward the evening before. Everything you save stays in this browser.`}
        </p>
      </section>
    </>
  );
}
