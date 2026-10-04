import { COMPONENTS, getComponent } from '../data/components';
import type { Method } from '../data/types';
import { formatNumber } from '../lib/format';
import { componentNutrition } from '../lib/nutrition';
import { ROLE_TITLES, formatPortion } from '../lib/prep';
import { hrefFor } from '../router';

const METHOD_LABELS: Record<Method, string> = {
  'air-fryer': 'Air fryer',
  stovetop: 'Stovetop',
  blender: 'Blender',
  oven: 'Oven',
  'no-cook': 'No-cook',
};

// Hash navigation adds history entries, so Back returns to whichever page linked here.
const goBack = (event: Event) => {
  if (history.length > 1) {
    event.preventDefault();
    history.back();
  }
};

export function ComponentDetail({ id }: { id: string }) {
  const component = getComponent(id);

  if (!component) {
    return (
      <>
        <header class="page-header">
          <h1>Recipe not found</h1>
        </header>
        <p>
          <a href={hrefFor({ name: 'prep', week: null })}>Go to this week's prep</a>
        </p>
      </>
    );
  }

  const nutrition = componentNutrition(id);
  const briefDiffers = component.briefKcal !== undefined && Math.round(nutrition.kcal) !== component.briefKcal;

  return (
    <>
      <header class="page-header">
        <a class="back-link" href={hrefFor({ name: 'prep', week: null })} onClick={goBack}>
          Back
        </a>
        <p class="eyebrow">{ROLE_TITLES[component.role].replace(/s$/, '')}</p>
        <h1>{component.name}</h1>
        <div class="badges">
          {component.methods.map((method) => (
            <span key={method} class="badge">
              {METHOD_LABELS[method]}
            </span>
          ))}
          {component.source === 'brief' && <span class="badge badge-today">From the brief</span>}
        </div>
      </header>

      <section class="card stats" aria-label="Nutrition estimate">
        <div>
          <span class="stat-value">{formatNumber(nutrition.kcal)}</span>
          <span class="stat-label">kcal</span>
        </div>
        <div>
          <span class="stat-value">{`${formatNumber(nutrition.protein)} g`}</span>
          <span class="stat-label">protein</span>
        </div>
        <p class="meta stats-note">{`Per portion: ${formatPortion(component.portion, 1)}.`}</p>
        {briefDiffers && (
          <p class="meta stats-note">
            {`Brief lists ~${component.briefKcal} kcal; this estimate is calculated from the ingredients.`}
          </p>
        )}
      </section>

      <section class="card" aria-labelledby="ingredients-title">
        <h2 id="ingredients-title">Ingredients (one portion)</h2>
        <ul class="ingredients">
          {component.uses.map((use) => (
            <li key={use.componentId}>
              <a href={hrefFor({ name: 'component', id: use.componentId })}>{COMPONENTS[use.componentId].name}</a>
              {use.servings !== 1 ? ` × ${use.servings}` : ''}
            </li>
          ))}
          {component.ingredients.map((ingredient, index) => (
            <li key={index}>{ingredient.amount}</li>
          ))}
        </ul>
      </section>

      <section class="card" aria-labelledby="method-title">
        <h2 id="method-title">Method</h2>
        <ol class="steps">
          {component.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>
    </>
  );
}
