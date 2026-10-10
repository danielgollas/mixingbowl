import { MealCard } from '../components/MealCard';
import { TotalsBar } from '../components/TotalsBar';
import { SLOT_LABELS } from '../data/meals';
import { formatGrams, formatKcal, formatLongDate, formatNumber } from '../lib/format';
import { ZERO, addNutrition } from '../lib/nutrition';
import { dayPlan, planInput } from '../lib/prep';
import { programPosition } from '../lib/program';
import { KCAL_MAX, KCAL_MIN, proteinTarget } from '../lib/targets';
import { hrefFor } from '../router';
import { useAppState } from '../state';

export function Today() {
  const { data, today, person, toggleEaten, setActivePerson } = useAppState();
  const { settings } = data;
  const position = programPosition(settings.startDate, today);
  const plan = dayPlan(planInput(data, person), position.week, position.day);
  const eatenSlots = position.started ? (data.eaten[person.id]?.[today] ?? []) : [];
  const eaten = plan.meals
    .filter((m) => eatenSlots.includes(m.slot))
    .reduce((sum, m) => addNutrition(sum, m.nutrition), ZERO);
  const target = proteinTarget(person.targetWeight, settings.unit);

  return (
    <>
      <header class="page-header">
        <p class="eyebrow">{formatLongDate(today)}</p>
        <h1>
          Day {position.day} · Week {position.week}
        </h1>
      </header>

      {data.people.length > 1 && (
        <fieldset class="segmented people-switch">
          <legend class="visually-hidden">Whose day</legend>
          {data.people.map((p) => (
            <label key={p.id}>
              <input
                type="radio"
                name="person"
                value={p.id}
                checked={p.id === person.id}
                onChange={() => setActivePerson(p.id)}
              />
              <span>{p.name}</span>
            </label>
          ))}
        </fieldset>
      )}

      {!position.started && (
        <p class="notice">
          Program starts in {position.daysUntilStart} {position.daysUntilStart === 1 ? 'day' : 'days'}. Here's a
          preview of Day 1.
        </p>
      )}

      {target === null && (
        <a class="card prompt" href="#/settings">
          {data.people.length > 1 ? `Set ${person.name}'s target weight` : 'Set your target weight'} to see the
          protein target <span aria-hidden="true">→</span>
        </a>
      )}

      <TotalsBar eaten={eaten} planned={plan.total} target={target} />

      {!person.scale && (
        <p class="meta">{`Portions aren't scaled for ${data.people.length > 1 ? person.name : 'you'}. Turn scaling on in Settings.`}</p>
      )}

      {plan.over >= 0.5 && (
        <p class="notice">{`These meals add up to ${formatKcal(plan.over)} over ${formatNumber(KCAL_MAX)} kcal. Try fewer meals or lighter picks.`}</p>
      )}
      {plan.shortBy.protein >= 0.5 && (
        <p class="notice">{`Still about ${formatGrams(plan.shortBy.protein)} short of your protein target, even with bigger portions. A higher-protein bowl or snack would close it.`}</p>
      )}
      {plan.shortBy.kcal >= 0.5 && (
        <p class="notice">{`Still ${formatKcal(plan.shortBy.kcal)} under ${formatNumber(KCAL_MIN)} kcal, even with bigger portions.`}</p>
      )}

      <section class="meals" aria-label="Meals">
        {person.meals.map((slot) => {
          const scaled = plan.meals.find((m) => m.slot === slot);
          if (!scaled) {
            return (
              <article key={slot} class="card meal-empty">
                <p class="eyebrow">{SLOT_LABELS[slot]}</p>
                <p>
                  {`Nothing planned for ${SLOT_LABELS[slot].toLowerCase()} today. `}
                  <a href={hrefFor({ name: 'menu', week: position.week })}>Plan it on the menu</a>
                </p>
              </article>
            );
          }
          return (
            <MealCard
              key={slot}
              scaled={scaled}
              eaten={eatenSlots.includes(slot)}
              disabled={!position.started}
              onToggle={() => toggleEaten(person.id, today, slot)}
            />
          );
        })}
      </section>

      {plan.meals.some((m) => Object.values(m.servings).some((s) => s !== 1)) && (
        <p class="meta">Portions marked × are scaled up to reach your daily targets.</p>
      )}
    </>
  );
}
