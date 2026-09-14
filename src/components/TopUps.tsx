import type { Nutrition } from '../data/types';
import { formatGrams, formatKcal, formatNumber } from '../lib/format';
import { KCAL_MAX, KCAL_MIN, suggestTopUps, type Range } from '../lib/topups';

interface Props {
  planned: Nutrition;
  target: Range | null;
}

export function TopUps({ planned, target }: Props) {
  const result = suggestTopUps(planned, target?.min ?? null);
  const kcalShort = planned.kcal < KCAL_MIN;
  const proteinShort = target !== null && planned.protein < target.min;
  const floor = [kcalShort && `${formatNumber(KCAL_MIN)} kcal`, proteinShort && 'your protein target']
    .filter(Boolean)
    .join(' and ');

  return (
    <section class="card topups" aria-labelledby="topups-title">
      <h2 id="topups-title">Top-ups</h2>
      <p>
        {`Today's plan is below ${floor}. `}
        {result.items.length > 0
          ? 'Add these to close the gap:'
          : `No top-up fits under the ${formatNumber(KCAL_MAX)} kcal ceiling.`}
      </p>
      {result.items.length > 0 && (
        <ul class="topup-list">
          {result.items.map((item) => (
            <li key={item.foodId}>
              <span class="topup-food">{`+${item.grams} g ${item.name}`}</span>
              <span class="meta">{`${formatKcal(item.kcal)} · ${formatGrams(item.protein)} protein`}</span>
            </li>
          ))}
        </ul>
      )}
      <p class="meta">{`With top-ups: ${formatKcal(result.after.kcal)} · ${formatGrams(result.after.protein)} protein`}</p>
      {result.unmet.protein >= 0.5 && (
        <p class="warning">
          {`Still about ${formatGrams(result.unmet.protein)} short of your protein target without going over ${formatNumber(KCAL_MAX)} kcal.`}
        </p>
      )}
      {result.unmet.kcal >= 0.5 && (
        <p class="warning">{`Still ${formatKcal(result.unmet.kcal)} under ${formatNumber(KCAL_MIN)} kcal.`}</p>
      )}
    </section>
  );
}
