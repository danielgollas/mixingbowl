import { MealCard } from '../components/MealCard';
import { TopUps } from '../components/TopUps';
import { TotalsBar } from '../components/TotalsBar';
import { PLAN } from '../data/plan';
import { SLOTS } from '../data/types';
import { formatLongDate } from '../lib/format';
import { patternTotals, slotsTotals } from '../lib/nutrition';
import { programPosition } from '../lib/program';
import { KCAL_MIN, proteinTarget } from '../lib/topups';
import { useAppState } from '../state';

export function Today() {
  const { data, today, toggleEaten } = useAppState();
  const { settings } = data;
  const position = programPosition(settings.startDate, today);
  const planned = patternTotals(position.pattern);
  const eatenSlots = position.started ? (data.eaten[today] ?? []) : [];
  const eaten = slotsTotals(position.pattern, eatenSlots);
  const target = proteinTarget(settings.targetWeight, settings.unit);
  const isShort = planned.kcal < KCAL_MIN || (target !== null && planned.protein < target.min);

  return (
    <>
      <header class="page-header">
        <p class="eyebrow">{formatLongDate(today)}</p>
        <div class="title-row">
          <h1>
            Day {position.day} · Week {position.week}
          </h1>
          <span class={`badge pattern-${position.pattern.toLowerCase()}`}>Pattern {position.pattern}</span>
        </div>
      </header>

      {!position.started && (
        <p class="notice">
          Program starts in {position.daysUntilStart} {position.daysUntilStart === 1 ? 'day' : 'days'}. Here's a
          preview of Day 1.
        </p>
      )}

      {target === null && (
        <a class="card prompt" href="#/settings">
          Set your target weight to see your protein target <span aria-hidden="true">→</span>
        </a>
      )}

      <TotalsBar eaten={eaten} planned={planned} target={target} />

      <section class="meals" aria-label="Meals">
        {SLOTS.map((slot) => (
          <MealCard
            key={slot}
            slot={slot}
            recipeId={PLAN[position.pattern][slot]}
            eaten={eatenSlots.includes(slot)}
            disabled={!position.started}
            onToggle={() => toggleEaten(today, slot)}
          />
        ))}
      </section>

      {isShort && <TopUps planned={planned} target={target} />}
    </>
  );
}
