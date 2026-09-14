import type { Nutrition } from '../data/types';
import { formatNumber } from '../lib/format';
import { KCAL_MAX, KCAL_MIN, type Range } from '../lib/topups';

interface Props {
  eaten: Nutrition;
  planned: Nutrition;
  /** Protein target range; null until a target weight is set. */
  target: Range | null;
}

export function TotalsBar({ eaten, planned, target }: Props) {
  return (
    <section class="card totals" aria-label="Daily totals">
      <Meter
        label="Calories"
        unit="kcal"
        eaten={eaten.kcal}
        planned={planned.kcal}
        range={{ min: KCAL_MIN, max: KCAL_MAX }}
      />
      <Meter label="Protein" unit="g" eaten={eaten.protein} planned={planned.protein} range={target} />
    </section>
  );
}

interface MeterProps {
  label: string;
  unit: 'kcal' | 'g';
  eaten: number;
  planned: number;
  range: Range | null;
}

function Meter({ label, unit, eaten, planned, range }: MeterProps) {
  const scale = Math.max(range?.max ?? 0, planned, eaten) || 1;
  const percent = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  return (
    <div class="meter">
      <div class="meter-head">
        <span class="meter-label">{label}</span>
        <span class="meter-target">
          {range ? `Target ${formatNumber(range.min)}–${formatNumber(range.max)} ${unit}` : 'No target yet'}
        </span>
      </div>
      <div class="meter-track" aria-hidden="true">
        <div class="meter-planned" style={{ width: percent(planned) }} />
        <div class="meter-eaten" style={{ width: percent(eaten) }} />
        {range && (
          <div
            class="meter-band"
            style={{ left: percent(range.min), width: `calc(${percent(range.max)} - ${percent(range.min)})` }}
          />
        )}
      </div>
      <p class="meter-text">{`${formatNumber(eaten)} ${unit} eaten · ${formatNumber(planned)} ${unit} planned`}</p>
    </div>
  );
}
