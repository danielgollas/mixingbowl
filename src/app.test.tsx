import { fireEvent, render, screen, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { STORAGE_KEY, defaultData, type AppData, type Person, type Settings } from './lib/storage';

const TODAY = '2026-09-14';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 12));
});

/** Settings fields go to the shared settings; person fields go to the first person, "Me". */
function renderApp(
  hash: string,
  overrides: Partial<Settings> & Partial<Omit<Person, 'id'>> = {},
  extra: Partial<AppData> = {},
) {
  const { startDate, unit, ...person } = overrides;
  const data = { ...defaultData(TODAY), ...extra };
  data.settings = { ...data.settings, ...(startDate && { startDate }), ...(unit && { unit }) };
  if (!extra.people) data.people = [{ ...data.people[0], ...person }];
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
    expect(stored().eaten).toEqual({ me: { [TODAY]: ['snack'] } });
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
  });

  it('adds more variations to a full week by taking a day from the item with the most days', () => {
    renderApp('#/menu');
    const dinner = within(section('Dinner'));
    dinner.getByText(/takes a day from the item with the most days/);
    fireEvent.change(dinner.getByLabelText('Add to dinner'), { target: { value: 'seitan-soba-bowl' } });
    fireEvent.change(dinner.getByLabelText('Add to dinner'), { target: { value: 'yuba-noodle-bowl' } });
    expect(stored().menus[1].dinner).toEqual([
      { mealId: 'scramble-bowl', days: 3 },
      { mealId: 'crispy-tofu-bowl', days: 2 },
      { mealId: 'seitan-soba-bowl', days: 1 },
      { mealId: 'yuba-noodle-bowl', days: 1 },
    ]);
    expect(section('Dinner').textContent).toContain('Day 7');
  });

  it('stops adding once every day has its own item', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ mealId: i % 2 ? 'scramble-bowl' : 'seitan-soba-bowl', days: 1 }));
    renderApp('#/menu', {}, { menus: { 1: { dinner: seven } } });
    expect((screen.getByLabelText('Add to dinner') as HTMLSelectElement).disabled).toBe(true);
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

describe('People', () => {
  const household: Partial<AppData> = {
    people: [
      { id: 'me', name: 'Me', targetWeight: 160, meals: ['snack', 'dinner'], scale: true, maintenance: null },
      { id: 'alex', name: 'Alex', targetWeight: null, meals: ['dinner'], scale: true, maintenance: null },
    ],
  };

  it('adds a person in Settings with their own weight and meals', () => {
    renderApp('#/settings');
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    const alex = within(screen.getByRole('article', { name: 'Person 2' }));
    fireEvent.input(alex.getByLabelText('Name'), { target: { value: 'Alex' } });
    fireEvent.input(alex.getByLabelText('Target weight'), { target: { value: '130' } });
    fireEvent.click(alex.getByRole('checkbox', { name: /Snack/ }));
    expect(stored().people[1]).toMatchObject({ name: 'Alex', targetWeight: 130, meals: ['dinner'] });
  });

  it('switches whose day Today shows and keeps eaten separate', () => {
    renderApp('#/today', {}, household);
    expect(screen.getAllByRole('button', { name: /eaten$/ })).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Alex'));
    expect(stored().activePerson).toBe('alex');
    expect(screen.getAllByRole('button', { name: /eaten$/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Scramble Bowl eaten' }));
    expect(stored().eaten).toEqual({ alex: { [TODAY]: ['dinner'] } });
    screen.getByRole('link', { name: /Set Alex's target weight/ });
  });

  it('adds everyone up on Prep and shows each person’s share', () => {
    renderApp('#/prep', {}, household);
    screen.getByText(/for 2 people/);
    const scramble = screen.getByRole('checkbox', { name: /Tofu scramble/ }).closest('li')!;
    expect(scramble.textContent).toMatch(/Me [\d,]+ g tofu · Alex [\d,]+ g tofu/);
  });

  it('shows who eats each meal on the Menu', () => {
    renderApp('#/menu', {}, household);
    expect(section('Snack').textContent).toContain('· Me');
    expect(section('Dinner').textContent).toContain('· Me, Alex');
  });

  it('turns off scaling for one person', () => {
    renderApp('#/settings', {}, household);
    const alex = within(screen.getByRole('article', { name: 'Alex' }));
    fireEvent.click(alex.getByRole('checkbox', { name: /Scale portions to targets/ }));
    expect(stored().people[1].scale).toBe(false);

    navigate('#/today');
    fireEvent.click(screen.getByLabelText('Alex'));
    screen.getByText("Portions aren't scaled for Alex. Turn scaling on in Settings.");
    const scramble = screen.getByRole('link', { name: 'Tofu scramble' }).parentElement!;
    expect(scramble.textContent).toContain('150 g tofu');
    expect(scramble.textContent).not.toContain('×');
  });

  it('asks before removing a person', () => {
    renderApp('#/settings', {}, household);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alex…' }));
    expect(stored().people).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alex…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alex' }));
    expect(stored().people.map((p) => p.name)).toEqual(['Me']);
    expect(screen.queryByRole('button', { name: /^Remove Me/ })).toBeNull();
  });
});

describe('Nutrients', () => {
  it('shows fat, fiber and sugars for the day and each meal', () => {
    renderApp('#/today');
    const totals = screen.getByRole('region', { name: 'Daily totals' });
    for (const label of ['Fat', 'Fiber', 'Sugars']) within(totals).getByText(label);
    expect(screen.getAllByText(/g fat · \d+ g fiber · \d+ g sugars/).length).toBeGreaterThanOrEqual(2);
  });

  it('lists them on recipe pages', () => {
    renderApp('#/components/lentils');
    const stats = screen.getByRole('region', { name: 'Nutrition estimate' });
    for (const label of ['protein', 'fat', 'fiber', 'sugars']) within(stats).getByText(label);
  });
});

describe('Print', () => {
  it('lays out the week’s menu, batch recipes and shopping list', () => {
    renderApp('#/prep');
    navigate(screen.getByRole('link', { name: "Print this week's recipes" }).getAttribute('href')!);
    expect(heading()).toBe('Week 1 recipes');
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(8);
    expect(rows[1].textContent).toContain('Protein Fluff');
    expect(rows[1].textContent).toContain('Scramble Bowl');
    screen.getByRole('heading', { name: 'Tofu scramble' });
    expect(screen.getAllByText(/g extra-firm tofu \([\d.]+ blocks\)/).length).toBeGreaterThan(0);
    screen.getByRole('heading', { name: 'Shopping list' });
    expect(screen.getByRole('navigation', { name: 'Main' }).querySelector('[aria-current]')?.textContent).toBe('Prep');
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
    expect(stored().people[0].targetWeight).toBeNull();

    fireEvent.input(input, { target: { value: '160' } });
    expect(screen.queryByText('Enter a weight between 80 and 600 lb.')).toBeNull();
    expect(stored().people[0].targetWeight).toBe(160);
    screen.getByText('128–160 g protein per day');
  });

  it('converts the weight when switching units', () => {
    renderApp('#/settings', { targetWeight: 160 });
    fireEvent.click(screen.getByLabelText('kg'));
    expect(stored().settings.unit).toBe('kg');
    expect(stored().people[0].targetWeight).toBe(72.6);
    expect((screen.getByLabelText('Target weight') as HTMLInputElement).value).toBe('72.6');
  });

  it('keeps a saved weight when the browser cannot parse the typed text', () => {
    renderApp('#/settings', { targetWeight: 160 });
    const input = screen.getByLabelText('Target weight');
    // Number inputs report unparseable text (e.g. "72,5") as value "" with validity.badInput set.
    Object.defineProperty(input, 'validity', { configurable: true, value: { badInput: true } });
    fireEvent.input(input, { target: { value: '' } });
    expect(stored().people[0].targetWeight).toBe(160);
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
    expect(stored().people[0].meals).toEqual(['lunch', 'snack', 'dinner']);
    fireEvent.click(screen.getByRole('checkbox', { name: /Snack/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Lunch/ }));
    expect(stored().people[0].meals).toEqual(['dinner']);
    expect((screen.getByRole('checkbox', { name: /Dinner/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it('changes the start date', () => {
    renderApp('#/settings');
    fireEvent.input(screen.getByLabelText('Start date'), { target: { value: '2026-09-10' } });
    expect(stored().settings.startDate).toBe('2026-09-10');
  });
});

describe('menu stats', () => {
  const stats = () => screen.getByRole('region', { name: 'Daily averages' });

  it('shows each person’s daily averages against their targets, and updates as the menu changes', () => {
    renderApp('#/menu', { targetWeight: 160 });
    expect(stats().textContent).toMatch(/kcal/);
    expect(stats().textContent).toContain('of 128–160 g');
    expect(stats().textContent).toMatch(/Fat.*Fiber.*Sugars/);
    expect(stats().textContent).toContain('Add maintenance calories in Settings to see the deficit.');
    const before = stats().textContent;
    const dinner = section('Dinner');
    fireEvent.click(within(dinner).getAllByRole('button', { name: /^Remove / })[0]);
    expect(stats().textContent).not.toBe(before);
    expect(stats().textContent).toContain('4 unplanned days count as nothing eaten.');
  });

  it('shows the calorie deficit once maintenance calories are set', () => {
    renderApp('#/menu', { targetWeight: 160, maintenance: 2400 });
    expect(stats().textContent).toMatch(/Deficit [\d,]+ kcal\/day · [\d,]+ kcal\/week · ≈ [\d.]+ lb\/week/);
  });

  it('calls a negative deficit a surplus', () => {
    renderApp('#/menu', { targetWeight: 160, maintenance: 1000 });
    expect(stats().textContent).toMatch(/Surplus [\d,]+ kcal\/day/);
  });

  it('names each person when there are several', () => {
    renderApp('#/menu', {}, {
      people: [
        { id: 'me', name: 'Me', targetWeight: 160, meals: ['snack', 'dinner'], scale: true, maintenance: null },
        { id: 'alex', name: 'Alex', targetWeight: null, meals: ['dinner'], scale: true, maintenance: 1800 },
      ],
    });
    expect(within(stats()).getByRole('heading', { name: 'Alex' })).toBeTruthy();
    expect(within(stats()).getByRole('heading', { name: 'Me' })).toBeTruthy();
  });
});

describe('maintenance calories setting', () => {
  it('saves a valid value and explains an invalid one', () => {
    renderApp('#/settings');
    const input = screen.getByLabelText('Maintenance calories');
    fireEvent.input(input, { target: { value: '2200' } });
    expect(stored().people[0].maintenance).toBe(2200);
    fireEvent.input(input, { target: { value: '500' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert').textContent).toBe('Enter between 1,000 and 5,000 kcal a day.');
    expect(stored().people[0].maintenance).toBe(2200);
    fireEvent.input(input, { target: { value: '' } });
    expect(stored().people[0].maintenance).toBeNull();
  });
});

describe('random swaps', () => {
  it('re-rolls one part of a preset into your own copy', () => {
    renderApp('#/menu');
    const dinner = section('Dinner');
    fireEvent.click(within(dinner).getAllByRole('button', { name: 'Swap ingredients' })[0]);
    const before = (within(dinner).getByLabelText('Sauce') as HTMLSelectElement).value;
    fireEvent.click(within(dinner).getByRole('button', { name: 'Random sauce' }));
    const custom = Object.values(stored().customMeals);
    expect(custom).toHaveLength(1);
    expect(custom[0].parts).not.toContain(before);
    expect(stored().menus[1].dinner![0].mealId).toBe(custom[0].id);
    expect((within(dinner).getByLabelText('Sauce') as HTMLSelectElement).value).not.toBe(before);
  });

  it('re-rolls the veg as a new set of the same size', () => {
    renderApp('#/menu');
    const dinner = section('Dinner');
    fireEvent.click(within(dinner).getAllByRole('button', { name: 'Swap ingredients' })[0]);
    const checked = () =>
      within(dinner)
        .getAllByRole('checkbox')
        .filter((c) => (c as HTMLInputElement).checked)
        .map((c) => c.parentElement!.textContent);
    const before = checked();
    fireEvent.click(within(dinner).getByRole('button', { name: 'Random veg' }));
    expect(checked()).toHaveLength(before.length);
    expect(checked()).not.toEqual(before);
  });
});
