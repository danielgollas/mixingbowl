import { PLAN, SLOT_LABELS } from '../data/plan';
import { RECIPES } from '../data/recipes';
import { SLOTS } from '../data/types';
import { formatGrams, formatKcal, formatShortDate } from '../lib/format';
import { patternTotals } from '../lib/nutrition';
import { programPosition, weekDates } from '../lib/program';
import { hrefFor } from '../router';
import { useAppState } from '../state';

export function Week() {
  const { data, today } = useAppState();
  const { startDate } = data.settings;
  const dates = weekDates(startDate, today);
  const { week } = programPosition(startDate, dates[0]);

  return (
    <>
      <header class="page-header">
        <p class="eyebrow">{`${formatShortDate(dates[0])} – ${formatShortDate(dates[6])}`}</p>
        <h1>Week {week}</h1>
      </header>

      {dates.map((date) => {
        const position = programPosition(startDate, date);
        const totals = patternTotals(position.pattern);
        const isToday = date === today;
        return (
          <section
            key={date}
            class={`card day${isToday ? ' is-today' : ''}`}
            aria-label={`Day ${position.day}, ${formatShortDate(date)}`}
            aria-current={isToday ? 'date' : undefined}
          >
            <div class="title-row">
              <h2>
                Day {position.day} <span class="meta">{formatShortDate(date)}</span>
              </h2>
              <div class="badges">
                {isToday && <span class="badge badge-today">Today</span>}
                <span class={`badge pattern-${position.pattern.toLowerCase()}`}>Pattern {position.pattern}</span>
              </div>
            </div>
            <ul class="day-meals">
              {SLOTS.map((slot) => {
                const recipeId = PLAN[position.pattern][slot];
                return (
                  <li key={slot}>
                    <span class="meta">{SLOT_LABELS[slot]}</span>
                    <a href={hrefFor({ name: 'recipe', id: recipeId })}>{RECIPES[recipeId].name}</a>
                  </li>
                );
              })}
            </ul>
            <p class="meta">{`${formatKcal(totals.kcal)} · ${formatGrams(totals.protein)} protein planned`}</p>
          </section>
        );
      })}
    </>
  );
}
