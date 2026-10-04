import { WeekHeader, useWeek } from '../components/WeekHeader';
import { planInput, shoppingList, weekPlan, weekTotals } from '../lib/prep';
import { useAppState } from '../state';

export function Shopping({ week: routeWeek }: { week: number | null }) {
  const { data, toggleShopping, clearShopping } = useAppState();
  const week = useWeek(routeWeek);
  const groups = shoppingList(weekTotals(weekPlan(planInput(data), week)));
  const checkedIds = data.checks[week]?.shopping ?? [];
  const lines = groups.flatMap((g) => g.lines);
  const checked = lines.filter((line) => checkedIds.includes(line.id)).length;

  return (
    <>
      <WeekHeader page="shopping" title="Shopping" week={week} />
      <div class="title-row">
        <p class="meta">{`${checked} of ${lines.length} checked`}</p>
        <button type="button" class="button-secondary" onClick={() => clearShopping(week)} disabled={checked === 0}>
          Uncheck all
        </button>
      </div>

      {groups.map((group, index) => (
        <section key={group.category} class="group" aria-labelledby={`shopping-${index}`}>
          <h2 id={`shopping-${index}`}>{group.category}</h2>
          <ul class="card list">
            {group.lines.map((line) => (
              <li key={line.id}>
                <label class="check">
                  <input
                    type="checkbox"
                    checked={checkedIds.includes(line.id)}
                    onChange={() => toggleShopping(week, line.id)}
                  />
                  <span class="check-text">
                    <span>{line.name}</span>
                    {line.amount && (
                      <span class="meta">{line.note ? `${line.amount} · ${line.note}` : line.amount}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
