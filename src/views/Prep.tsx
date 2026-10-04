import { WeekHeader, useWeek } from '../components/WeekHeader';
import { planInput, prepList, weekPlan, weekTotals } from '../lib/prep';
import { hrefFor } from '../router';
import { useAppState } from '../state';

export function Prep({ week: routeWeek }: { week: number | null }) {
  const { data, togglePrep } = useAppState();
  const week = useWeek(routeWeek);
  const totals = weekTotals(weekPlan(planInput(data), week));
  const groups = prepList(totals);
  const checked = data.checks[week]?.prep ?? [];
  const lines = groups.flatMap((g) => g.lines);
  const done = lines.filter((line) => checked.includes(line.id)).length;

  return (
    <>
      <WeekHeader page="prep" title="Prep" week={week} />
      <p class="meta">
        {lines.length > 0
          ? `Batch prep for ${totals.meals} meals · ${done} of ${lines.length} done`
          : 'Nothing planned this week yet.'}
      </p>

      {groups.map((group) => (
        <section key={group.role} class="group" aria-labelledby={`prep-${group.role}`}>
          <h2 id={`prep-${group.role}`}>{group.title}</h2>
          <ul class="card list">
            {group.lines.map((line) => (
              <li key={line.id} class="check-row">
                <label class="check">
                  <input type="checkbox" checked={checked.includes(line.id)} onChange={() => togglePrep(week, line.id)} />
                  <span class="check-text">
                    <span class="list-title">{line.name}</span>
                    <span class="meta">{[line.amount, ...line.details].join(' · ')}</span>
                  </span>
                </label>
                <a class="row-link" href={hrefFor({ name: 'component', id: line.id })} aria-label={`${line.name} recipe`}>
                  Recipe
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
