import { formatDecimal, formatNumber } from '../lib/format';
import { personWeekStats } from '../lib/stats';
import { hrefFor } from '../router';
import { useAppState } from '../state';

/** Each person's planned daily averages for the week, and their calorie deficit. */
export function MenuStats({ week }: { week: number }) {
  const { data } = useAppState();
  const several = data.people.length > 1;
  const unit = data.settings.unit;

  return (
    <section class="card menu-stats" aria-labelledby="menu-stats-title">
      <h2 id="menu-stats-title">Daily averages</h2>
      {data.people.map((person) => {
        const { average, target, deficit, unplannedDays } = personWeekStats(data, person, week);
        return (
          <div key={person.id} class="person-stats">
            {several && <h3>{person.name}</h3>}
            <dl class="stats-grid">
              <div>
                <dt>Calories</dt>
                <dd>{`${formatNumber(average.kcal)} kcal`}</dd>
              </div>
              <div>
                <dt>Protein</dt>
                <dd>
                  {`${formatNumber(average.protein)} g`}
                  {target && <span class="meta">{` of ${formatNumber(target.min)}–${formatNumber(target.max)} g`}</span>}
                </dd>
              </div>
              <div>
                <dt>Fat</dt>
                <dd>{`${formatNumber(average.fat)} g`}</dd>
              </div>
              <div>
                <dt>Fiber</dt>
                <dd>{`${formatNumber(average.fiber)} g`}</dd>
              </div>
              <div>
                <dt>Sugars</dt>
                <dd>{`${formatNumber(average.sugar)} g`}</dd>
              </div>
            </dl>
            {deficit ? (
              <p class="deficit">
                {`${deficit.perDay >= 0 ? 'Deficit' : 'Surplus'} ${formatNumber(Math.abs(deficit.perDay))} kcal/day · ${formatNumber(Math.abs(deficit.perWeek))} kcal/week · ≈ ${formatDecimal(Math.abs(deficit.weightPerWeek))} ${unit}/week`}
              </p>
            ) : (
              <p class="meta">
                <a href={hrefFor({ name: 'settings' })}>Add maintenance calories in Settings</a> to see the deficit.
              </p>
            )}
            {unplannedDays > 0 && (
              <p class="meta">{`${unplannedDays} unplanned ${unplannedDays === 1 ? 'day counts' : 'days count'} as nothing eaten.`}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
