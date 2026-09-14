import { fireEvent, render, screen, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { STORAGE_KEY, defaultData, type AppData, type Settings } from './lib/storage';

const TODAY = '2026-09-14';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 12));
});

function renderApp(hash: string, settings: Partial<Settings> = {}) {
  const data = defaultData(TODAY);
  data.settings = { ...data.settings, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // replaceState doesn't fire hashchange, so the router reads this on first render.
  history.replaceState(null, '', hash);
  return render(<App />);
}

const stored = (): AppData => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('routing', () => {
  it('opens Today when there is no route', () => {
    renderApp('/');
    expect(heading()).toBe('Day 1 · Week 1');
    expect(location.hash).toBe('#/today');
  });

  it('marks the Recipes tab current on a recipe page', () => {
    renderApp('#/recipes/crispy-tofu');
    const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(tabs.getByRole('link', { name: 'Recipes' }).getAttribute('aria-current')).toBe('page');
    expect(tabs.getByRole('link', { name: 'Today' }).getAttribute('aria-current')).toBeNull();
  });
});

describe('Today', () => {
  it('shows the program day, pattern and four meals', () => {
    renderApp('#/today');
    expect(heading()).toBe('Day 1 · Week 1');
    screen.getByText('Pattern A');
    for (const name of [
      'The Infinite Tofu Scramble',
      'Air-Fried Crispy Tofu Salad',
      'The Massive Blended Protein Fluff',
      'Late-Night Charred Cabbage Chips',
    ]) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toMatch(/^#\/recipes\//);
    }
  });

  it('follows the start date into Pattern B', () => {
    renderApp('#/today', { startDate: '2026-09-13' });
    expect(heading()).toBe('Day 2 · Week 1');
    screen.getByText('Pattern B');
    screen.getByRole('link', { name: 'Silken Berry Protein Smoothie' });
  });

  it('marks a meal eaten, updates totals and saves it', () => {
    renderApp('#/today');
    const toggle = screen.getByRole('button', { name: 'The Infinite Tofu Scramble eaten' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(stored().eaten).toEqual({ [TODAY]: ['breakfast'] });
    expect(screen.getByRole('region', { name: 'Daily totals' }).textContent).toContain('298 kcal eaten');
  });

  it('asks for a target weight before showing a protein target', () => {
    renderApp('#/today');
    const prompt = screen.getByRole('link', { name: /set your target weight/i });
    expect(prompt.getAttribute('href')).toBe('#/settings');
  });

  it('suggests top-ups when the plan is short', () => {
    renderApp('#/today', { targetWeight: 160 });
    const card = screen.getByRole('region', { name: 'Top-ups' });
    expect(card.textContent).toContain('+100 g Seitan');
    expect(card.textContent).toContain('+100 g Extra-firm tofu');
    expect(screen.queryByRole('link', { name: /set your target weight/i })).toBeNull();
  });

  it('previews day 1 with toggles disabled before the start date', () => {
    renderApp('#/today', { startDate: '2026-09-20' });
    screen.getByText(/starts in 6 days/i);
    const toggles = screen.getAllByRole('button', { name: /eaten$/ });
    expect(toggles).toHaveLength(4);
    for (const toggle of toggles) expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Week', () => {
  it('lists the seven days of the current week and marks today', () => {
    renderApp('#/week', { startDate: '2026-09-13' });
    expect(heading()).toBe('Week 1');
    const days = screen.getAllByRole('region').filter((el) => el.getAttribute('aria-label')?.startsWith('Day '));
    expect(days).toHaveLength(7);
    const today = days.filter((el) => el.getAttribute('aria-current') === 'date');
    expect(today.map((el) => el.getAttribute('aria-label'))).toEqual(['Day 2, Mon, Sep 14']);
  });
});

describe('Recipes', () => {
  it('groups master recipes, plan meals and sauces', () => {
    renderApp('#/recipes');
    for (const name of ['Master recipes', 'Plan meals', 'Sauces']) screen.getByRole('heading', { name });
    expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(17);
  });

  it('deep-links to a recipe and links its sub-recipe', () => {
    renderApp('#/recipes/crispy-tofu-salad');
    expect(heading()).toBe('Air-Fried Crispy Tofu Salad');
    screen.getByText('Derived from brief');
    expect(screen.getByRole('link', { name: 'Crispy Air-Fried Tofu Base' }).getAttribute('href')).toBe(
      '#/recipes/crispy-tofu',
    );
  });

  it("notes when a sauce's estimate differs from the brief", () => {
    renderApp('#/recipes/dill-pickle-dip');
    screen.getByText(/Brief lists ~18 kcal/);
  });

  it('shows not found for an unknown recipe', () => {
    renderApp('#/recipes/nope');
    expect(heading()).toBe('Recipe not found');
  });
});

describe('Shopping', () => {
  it('saves checks across reloads and clears them for a new week', () => {
    const { unmount } = renderApp('#/shopping');
    const celery = () => screen.getByRole('checkbox', { name: 'Celery' }) as HTMLInputElement;
    fireEvent.click(celery());
    expect(celery().checked).toBe(true);
    expect(stored().shopping).toEqual({ celery: true });

    unmount();
    render(<App />);
    expect(celery().checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'New week' }));
    expect(celery().checked).toBe(false);
    expect(stored().shopping).toEqual({});
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

  it('changes the start date', () => {
    renderApp('#/settings');
    fireEvent.input(screen.getByLabelText('Start date'), { target: { value: '2026-09-10' } });
    expect(stored().settings.startDate).toBe('2026-09-10');
  });
});
