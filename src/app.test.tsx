import { fireEvent, render, screen, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { STORAGE_KEY, defaultData, type AppData, type Settings } from './lib/storage';

const TODAY = '2026-09-14';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 12));
});

function renderApp(hash: string, settings: Partial<Settings> = {}, extra: Partial<AppData> = {}) {
  const data = { ...defaultData(TODAY), ...extra };
  data.settings = { ...data.settings, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // replaceState doesn't fire hashchange, so the router reads this on first render.
  history.replaceState(null, '', hash);
  return render(<App />);
}

const stored = (): AppData => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const navigate = (hash: string) => {
  history.replaceState(null, '', hash);
  fireEvent(window, new HashChangeEvent('hashchange'));
};
const section = (name: string) => screen.getByRole('region', { name });

describe('routing', () => {
  it('opens Today when there is no route', () => {
    renderApp('/');
    expect(heading()).toBe('Day 1 · Week 1');
    expect(location.hash).toBe('#/today');
  });

  it('moves focus to the new page heading after navigating, but not on first load', () => {
    renderApp('#/today');
    expect(document.activeElement).toBe(document.body);
    navigate('#/menu');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Menu');
    expect(document.activeElement).toBe(h1);
  });

  it('shows five tabs and marks the current one', () => {
    renderApp('#/prep/2');
    const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(tabs.getAllByRole('link').map((l) => l.textContent)).toEqual(['Today', 'Menu', 'Prep', 'Shopping', 'Settings']);
    expect(tabs.getByRole('link', { name: 'Prep' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('Today', () => {
  it('shows the meals you eat with their parts', () => {
    renderApp('#/today');
    expect(heading()).toBe('Day 1 · Week 1');
    const meals = within(screen.getByRole('region', { name: 'Meals' }));
    expect(meals.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Protein Fluff', 'Scramble Bowl']);
    expect(meals.getByRole('link', { name: 'Tofu scramble' }).getAttribute('href')).toBe('#/components/tofu-scramble');
  });

  it('scales portions up to the targets and marks them', () => {
    renderApp('#/today');
    const scramble = screen.getByRole('link', { name: 'Tofu scramble' }).parentElement!;
    expect(scramble.textContent).toContain('450 g tofu ×3');
    screen.getByText(/scaled up to reach your daily targets/);
  });

  it('marks a meal eaten, updates totals and saves it', () => {
    renderApp('#/today');
    const toggle = screen.getByRole('button', { name: 'Protein Fluff eaten' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(stored().eaten).toEqual({ [TODAY]: ['snack'] });
    expect(screen.getByRole('region', { name: 'Daily totals' }).textContent).toContain('156 kcal eaten');
  });

  it('follows the meals you eat and the menu', () => {
    renderApp('#/today', { startDate: '2026-09-09', meals: ['breakfast', 'lunch', 'dinner'] });
    expect(heading()).toBe('Day 6 · Week 1');
    const meals = within(screen.getByRole('region', { name: 'Meals' }));
    expect(meals.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Protein Fluff',
      'Shirataki Glaze Bowl',
      'Crispy Tofu Bowl',
    ]);
  });

  it('says when a meal is unplanned and links to the menu', () => {
    renderApp('#/today', {}, { menus: { 1: { snack: [] } } });
    screen.getByText(/Nothing planned for snack today/);
    expect(screen.getByRole('link', { name: 'Plan it on the menu' }).getAttribute('href')).toBe('#/menu/1');
  });

  it('warns when the protein target is out of reach', () => {
    renderApp('#/today', { targetWeight: 200 });
    screen.getByText(/short of your protein target, even with bigger portions/);
    expect(screen.queryByRole('link', { name: /set your target weight/i })).toBeNull();
  });

  it('previews day 1 with toggles disabled before the start date', () => {
    renderApp('#/today', { startDate: '2026-09-20' });
    screen.getByText(/starts in 6 days/i);
    const toggles = screen.getAllByRole('button', { name: /eaten$/ });
    expect(toggles).toHaveLength(2);
    for (const toggle of toggles) expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Menu', () => {
  it('lists each meal you eat with its days', () => {
    renderApp('#/menu');
    expect(section('Snack').textContent).toContain('7 of 7 days');
    expect(section('Dinner').textContent).toContain('Days 1–4');
    expect(section('Dinner').textContent).toContain('Days 5–7');
    screen.getByText(/Week 1/);
  });

  it('caps the stepper at 7 days and fills new entries with the remaining days', () => {
    renderApp('#/menu');
    const dinner = within(section('Dinner'));
    expect((dinner.getByRole('button', { name: 'More days of Scramble Bowl' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(dinner.getByRole('button', { name: 'Fewer days of Scramble Bowl' }));
    fireEvent.click(dinner.getByRole('button', { name: 'Fewer days of Scramble Bowl' }));
    dinner.getByText('2 days unplanned');
    expect(stored().menus[1].dinner).toEqual([
      { mealId: 'scramble-bowl', days: 2 },
      { mealId: 'crispy-tofu-bowl', days: 3 },
    ]);

    fireEvent.change(dinner.getByLabelText('Add to dinner'), { target: { value: 'seitan-soba-bowl' } });
    expect(stored().menus[1].dinner!.at(-1)).toEqual({ mealId: 'seitan-soba-bowl', days: 2 });
    expect((dinner.getByLabelText('Add to dinner') as HTMLSelectElement).disabled).toBe(true);
  });

  it('only offers bowls for dinner and snacks for snack', () => {
    renderApp('#/menu');
    const names = (label: string) =>
      [...(screen.getByLabelText(label) as HTMLSelectElement).options].map((o) => o.textContent).slice(1);
    expect(names('Add to dinner')).toContain('Scramble Bowl');
    expect(names('Add to dinner')).not.toContain('Protein Fluff');
    expect(names('Add to snack')).toEqual(['Protein Fluff', 'Veggie Batons & Dill Dip', 'Edamame Cup', 'Silken Berry Smoothie', 'Charred Cabbage Chips']);
  });

  it('turns a swapped preset into your own bowl and updates Today and Prep', () => {
    renderApp('#/menu');
    const dinner = within(section('Dinner'));
    fireEvent.click(dinner.getAllByRole('button', { name: 'Swap ingredients' })[0]);
    fireEvent.change(dinner.getByLabelText('Bed'), { target: { value: 'quinoa' } });

    const [custom] = Object.values(stored().customMeals);
    expect(custom).toMatchObject({ name: 'Scramble Bowl (custom)', kind: 'bowl' });
    expect(custom.parts).toEqual(['quinoa', 'tofu-scramble', 'spinach-mushroom', 'cheesy-garlic-dressing', 'hemp-hearts']);
    expect(stored().menus[1].dinner![0]).toEqual({ mealId: custom.id, days: 4 });
    expect((dinner.getByLabelText('Name') as HTMLInputElement).value).toBe('Scramble Bowl (custom)');

    fireEvent.click(dinner.getByRole('checkbox', { name: 'Roasted broccoli' }));
    expect(stored().customMeals[custom.id].parts).toContain('roasted-broccoli');
    expect(Object.keys(stored().customMeals)).toHaveLength(1);

    navigate('#/today');
    screen.getByRole('heading', { name: 'Scramble Bowl (custom)' });
    screen.getByRole('link', { name: 'Quinoa' });

    navigate('#/prep');
    screen.getByRole('checkbox', { name: /Quinoa/ });
    screen.getByRole('checkbox', { name: /Roasted broccoli/ });
  });

  it('removes an entry', () => {
    renderApp('#/menu');
    fireEvent.click(within(section('Snack')).getByRole('button', { name: 'Remove Veggie Batons & Dill Dip' }));
    expect(stored().menus[1].snack).toEqual([{ mealId: 'protein-fluff', days: 4 }]);
  });

  it('moves between weeks, and later weeks follow an edited week', () => {
    renderApp('#/menu');
    fireEvent.click(within(section('Snack')).getByRole('button', { name: 'Remove Veggie Batons & Dill Dip' }));
    navigate(screen.getByRole('link', { name: 'Next week' }).getAttribute('href')!);
    screen.getByText('Week 2');
    expect(section('Snack').textContent).toContain('3 days unplanned');
  });
});

describe('Prep', () => {
  it('lists the week’s batch prep and saves checks per week', () => {
    const { unmount } = renderApp('#/prep');
    screen.getByRole('heading', { name: 'Beds' });
    const rice = () => screen.getByRole('checkbox', { name: /Brown rice/ }) as HTMLInputElement;
    expect(rice().closest('li')!.textContent).toContain('cups dry');
    fireEvent.click(rice());
    expect(stored().checks[1].prep).toEqual(['brown-rice']);

    unmount();
    render(<App />);
    expect(rice().checked).toBe(true);
    navigate('#/prep/2');
    expect(rice().checked).toBe(false);
  });

  it('links each line to its recipe', () => {
    renderApp('#/prep');
    expect(screen.getByRole('link', { name: 'Tofu scramble recipe' }).getAttribute('href')).toBe('#/components/tofu-scramble');
  });
});

describe('Shopping', () => {
  it('lists what to buy, saves checks per week and unchecks all', () => {
    renderApp('#/shopping');
    const tofu = () => screen.getByRole('checkbox', { name: /Extra-firm tofu/ }) as HTMLInputElement;
    expect(tofu().closest('li')!.textContent).toMatch(/\d+ blocks · uses/);
    expect(screen.queryByRole('checkbox', { name: /Salt/ })).toBeNull();
    fireEvent.click(tofu());
    expect(stored().checks[1].shopping).toEqual(['tofu-firm']);
    fireEvent.click(screen.getByRole('button', { name: 'Uncheck all' }));
    expect(tofu().checked).toBe(false);
  });
});

describe('Component page', () => {
  it('deep-links to a component and links the ones it uses', () => {
    renderApp('#/components/veggie-batons');
    expect(heading()).toBe('Veggie batons & dill dip');
    expect(screen.getByRole('link', { name: 'Creamy dill pickle dip' }).getAttribute('href')).toBe(
      '#/components/dill-pickle-dip',
    );
  });

  it("notes when a sauce's estimate differs from the brief", () => {
    renderApp('#/components/dill-pickle-dip');
    screen.getByText(/Brief lists ~18 kcal/);
  });

  it('shows not found for unknown ids, inherited keys and malformed escapes', () => {
    const { unmount } = renderApp('#/components/constructor');
    expect(heading()).toBe('Recipe not found');
    unmount();
    renderApp('#/components/%');
    expect(heading()).toBe('Day 1 · Week 1');
  });
});

describe('Settings', () => {
  it('validates the target weight before saving it', () => {
    renderApp('#/settings');
    const input = screen.getByLabelText('Target weight');
    fireEvent.input(input, { target: { value: '20' } });
    expect(screen.queryByText('Enter a weight between 80 and 600 lb.')).toBeNull(); // no error mid-typing
    fireEvent.blur(input);
    screen.getByText('Enter a weight between 80 and 600 lb.');
    expect(stored().settings.targetWeight).toBeNull();

    fireEvent.input(input, { target: { value: '160' } });
    expect(screen.queryByText('Enter a weight between 80 and 600 lb.')).toBeNull();
    expect(stored().settings.targetWeight).toBe(160);
    screen.getByText('128–160 g protein per day');
  });

  it('converts the weight when switching units', () => {
    renderApp('#/settings', { targetWeight: 160 });
    fireEvent.click(screen.getByLabelText('kg'));
    expect(stored().settings).toMatchObject({ unit: 'kg', targetWeight: 72.6 });
    expect((screen.getByLabelText('Target weight') as HTMLInputElement).value).toBe('72.6');
  });

  it('keeps a saved weight when the browser cannot parse the typed text', () => {
    renderApp('#/settings', { targetWeight: 160 });
    const input = screen.getByLabelText('Target weight');
    // Number inputs report unparseable text (e.g. "72,5") as value "" with validity.badInput set.
    Object.defineProperty(input, 'validity', { configurable: true, value: { badInput: true } });
    fireEvent.input(input, { target: { value: '' } });
    expect(stored().settings.targetWeight).toBe(160);
    fireEvent.blur(input);
    screen.getByText('Enter a weight between 80 and 600 lb.');
  });

  it('ignores a cleared start date without showing an error', () => {
    renderApp('#/settings');
    fireEvent.input(screen.getByLabelText('Start date'), { target: { value: '' } });
    expect(stored().settings.startDate).toBe(TODAY);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('chooses which meals you eat, keeping at least one', () => {
    renderApp('#/settings');
    fireEvent.click(screen.getByRole('checkbox', { name: /Lunch/ }));
    expect(stored().settings.meals).toEqual(['lunch', 'snack', 'dinner']);
    fireEvent.click(screen.getByRole('checkbox', { name: /Snack/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Lunch/ }));
    expect(stored().settings.meals).toEqual(['dinner']);
    expect((screen.getByRole('checkbox', { name: /Dinner/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it('changes the start date', () => {
    renderApp('#/settings');
    fireEvent.input(screen.getByLabelText('Start date'), { target: { value: '2026-09-10' } });
    expect(stored().settings.startDate).toBe('2026-09-10');
  });
});
