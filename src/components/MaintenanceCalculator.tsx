import { useState } from 'preact/hooks';
import { formatNumber } from '../lib/format';
import { ACTIVITIES, estimateMaintenance, isValidBody, type Body } from '../lib/maintenance';
import { LB_PER_KG, type WeightUnit } from '../lib/targets';

const CM_PER_INCH = 2.54;
const round = (value: number, places: number) => Number(value.toFixed(places));
const text = (value: number | null) => (value === null ? '' : value.toString());
const toNumber = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

interface Props {
  id: string;
  body?: Body;
  unit: WeightUnit;
  onUse(body: Body, maintenance: number): void;
  onClose(): void;
}

/** Estimates maintenance calories from a few answers. Nothing is saved until Use this. */
export function MaintenanceCalculator({ id, body, unit, onUse, onClose }: Props) {
  const imperial = unit === 'lb';
  const inches = body ? Math.round(body.heightCm / CM_PER_INCH) : null;
  const [weight, setWeight] = useState(text(body ? round(imperial ? body.weightKg * LB_PER_KG : body.weightKg, 1) : null));
  const [feet, setFeet] = useState(text(inches === null ? null : Math.floor(inches / 12)));
  const [extraInches, setExtraInches] = useState(text(inches === null ? null : inches % 12));
  const [cm, setCm] = useState(text(body ? round(body.heightCm, 1) : null));
  const [age, setAge] = useState(text(body?.age ?? null));
  const [sex, setSex] = useState<string>(body?.sex ?? '');
  const [activity, setActivity] = useState<string>(body?.activity ?? '');

  const answers = {
    weightKg: round(imperial ? toNumber(weight) / LB_PER_KG : toNumber(weight), 2),
    heightCm: round(imperial ? (toNumber(feet) * 12 + toNumber(extraInches || '0')) * CM_PER_INCH : toNumber(cm), 1),
    age: toNumber(age),
    sex,
    activity,
  };
  const valid = isValidBody(answers) ? answers : null;
  const estimate = valid && estimateMaintenance(valid);

  return (
    <div class="calculator" role="group" aria-label="Maintenance calculator">
      <div class="field">
        <label for={`${id}-current`}>Current weight</label>
        <div class="input-row">
          <input
            id={`${id}-current`}
            type="number"
            inputMode="decimal"
            value={weight}
            onInput={(e) => setWeight(e.currentTarget.value)}
          />
          <span class="unit-suffix">{unit}</span>
        </div>
      </div>

      {imperial ? (
        <div class="field">
          <span class="field-label">Height</span>
          <div class="input-row">
            <input
              aria-label="Height, feet"
              type="number"
              inputMode="numeric"
              value={feet}
              onInput={(e) => setFeet(e.currentTarget.value)}
            />
            <span class="unit-suffix">ft</span>
            <input
              aria-label="Height, inches"
              type="number"
              inputMode="numeric"
              value={extraInches}
              onInput={(e) => setExtraInches(e.currentTarget.value)}
            />
            <span class="unit-suffix">in</span>
          </div>
        </div>
      ) : (
        <div class="field">
          <label for={`${id}-height`}>Height</label>
          <div class="input-row">
            <input
              id={`${id}-height`}
              type="number"
              inputMode="numeric"
              value={cm}
              onInput={(e) => setCm(e.currentTarget.value)}
            />
            <span class="unit-suffix">cm</span>
          </div>
        </div>
      )}

      <div class="field">
        <label for={`${id}-age`}>Age</label>
        <input
          id={`${id}-age`}
          type="number"
          inputMode="numeric"
          value={age}
          onInput={(e) => setAge(e.currentTarget.value)}
        />
      </div>

      <div class="field">
        <label for={`${id}-sex`}>Sex</label>
        <select id={`${id}-sex`} value={sex} onChange={(e) => setSex(e.currentTarget.value)}>
          <option value="">Choose</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>

      <div class="field">
        <label for={`${id}-activity`}>Activity</label>
        <select id={`${id}-activity`} value={activity} onChange={(e) => setActivity(e.currentTarget.value)}>
          <option value="">Choose</option>
          {ACTIVITIES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {estimate ? (
        <p role="status">{`About ${formatNumber(estimate)} kcal/day`}</p>
      ) : (
        <p class="meta">Answer everything to see an estimate. It's meant for adults 18 and over.</p>
      )}

      <div class="entry-actions">
        {valid && estimate && (
          <button type="button" class="button-secondary" onClick={() => onUse(valid, estimate)}>
            Use this
          </button>
        )}
        <button type="button" class="button-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
