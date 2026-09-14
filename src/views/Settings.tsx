import { useState } from 'preact/hooks';
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
} from '../lib/topups';
import { useAppState } from '../state';

const UNITS: WeightUnit[] = ['lb', 'kg'];

const parseWeight = (value: string): number | null => (value.trim() === '' ? null : Number(value));

export function Settings() {
  const { data, persistent, setSettings } = useAppState();
  const { settings } = data;
  const [weightDraft, setWeightDraft] = useState(settings.targetWeight?.toString() ?? '');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const range = WEIGHT_RANGE[settings.unit];
  const target = proteinTarget(settings.targetWeight, settings.unit);

  const onDateChange = (value: string) => {
    if (isIsoDate(value)) {
      setSettings({ startDate: value });
      setDateError(null);
    } else {
      setDateError('Choose a valid start date.');
    }
  };

  // Save as soon as the value is valid, but only complain once the field loses focus.
  const onWeightInput = (value: string) => {
    setWeightDraft(value);
    const weight = parseWeight(value);
    if (weight === null || isValidWeight(weight, settings.unit)) {
      setSettings({ targetWeight: weight });
      setWeightError(null);
    }
  };

  const onWeightBlur = () => {
    const weight = parseWeight(weightDraft);
    if (weight !== null && !isValidWeight(weight, settings.unit)) {
      setWeightError(`Enter a weight between ${range.min} and ${range.max} ${settings.unit}.`);
    }
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
            aria-invalid={dateError ? 'true' : undefined}
            onInput={(e) => onDateChange(e.currentTarget.value)}
            onChange={(e) => onDateChange(e.currentTarget.value)}
          />
          {dateError && (
            <p class="error" role="alert">
              {dateError}
            </p>
          )}
          <p class="meta">Day 1 of the seven-day cycle. Days 1, 3, 5 and 7 are Pattern A; days 2, 4 and 6 are Pattern B.</p>
        </div>
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
              onInput={(e) => onWeightInput(e.currentTarget.value)}
              onBlur={onWeightBlur}
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
          {`Daily calorie range: ${formatNumber(KCAL_MIN)}–${formatNumber(KCAL_MAX)} kcal. Calories and protein are estimated from approximate USDA values and will differ from your product labels. Everything you save stays in this browser.`}
        </p>
      </section>
    </>
  );
}
