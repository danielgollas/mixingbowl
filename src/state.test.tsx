import { fireEvent, render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, type StorageLike } from './lib/storage';
import { AppStateProvider, useAppState } from './state';

function Probe() {
  const state = useAppState();
  return (
    <div>
      <output data-testid="data">{JSON.stringify(state.data)}</output>
      <output data-testid="persistent">{String(state.persistent)}</output>
      <output data-testid="today">{state.today}</output>
      <button onClick={() => state.toggleEaten('me', '2026-09-14', 'lunch')}>lunch</button>
      <button onClick={() => state.toggleEaten('me', '2026-09-14', 'breakfast')}>breakfast</button>
      <button onClick={() => state.addPerson()}>add person</button>
      <button onClick={() => state.removePerson(state.data.people.at(-1)!.id)}>remove last</button>
      <button onClick={() => state.setActivePerson(state.data.people.at(-1)!.id)}>activate last</button>
      <button onClick={() => state.updatePerson('me', { name: 'Dan' })}>rename</button>
      <output data-testid="person">{state.person.name}</output>
      <button onClick={() => state.toggleShopping(1, 'celery')}>celery</button>
      <button onClick={() => state.toggleShopping(2, 'celery')}>celery 2</button>
      <button onClick={() => state.clearShopping(1)}>clear</button>
      <button onClick={() => state.togglePrep(1, 'brown-rice')}>rice</button>
      <button onClick={() => state.setMenu(2, 'dinner', [{ mealId: 'seitan-soba-bowl', days: 7 }])}>menu</button>
      <button
        onClick={() => state.saveCustomMeal({ id: 'custom-a', name: 'Mine', kind: 'bowl', parts: ['soba', 'yuba'] })}
      >
        custom
      </button>
      <button onClick={() => state.setSettings({ unit: 'kg' })}>weight</button>
    </div>
  );
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
const shown = () => JSON.parse(screen.getByTestId('data').textContent ?? 'null');
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 12));
});

describe('AppStateProvider', () => {
  it('saves the default start date on first launch', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    expect(stored().settings.startDate).toBe('2026-09-14');
    expect(screen.getByTestId('today').textContent).toBe('2026-09-14');
    expect(screen.getByTestId('persistent').textContent).toBe('true');
  });

  it('toggles eaten slots in slot order and drops empty dates', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    click('lunch');
    click('breakfast');
    expect(stored().eaten).toEqual({ me: { '2026-09-14': ['breakfast', 'lunch'] } });
    click('lunch');
    click('breakfast');
    expect(stored().eaten).toEqual({ me: {} });
  });

  it('adds, renames, switches to and removes people', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    click('add person');
    expect(stored().people.map((p: { name: string }) => p.name)).toEqual(['Me', 'Person 2']);
    click('activate last');
    expect(screen.getByTestId('person').textContent).toBe('Person 2');
    click('rename');
    expect(stored().people[0].name).toBe('Dan');
    click('remove last');
    expect(stored().people).toHaveLength(1);
    expect(stored().activePerson).toBe('me');
    click('remove last');
    expect(stored().people).toHaveLength(1);
  });

  it('toggles and clears shopping checks per week', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    click('celery');
    click('celery 2');
    expect(stored().checks).toEqual({ 1: { prep: [], shopping: ['celery'] }, 2: { prep: [], shopping: ['celery'] } });
    click('celery');
    expect(stored().checks[1].shopping).toEqual([]);
    click('celery');
    click('rice');
    click('clear');
    expect(stored().checks[1]).toEqual({ prep: ['brown-rice'], shopping: [] });
    expect(stored().checks[2].shopping).toEqual(['celery']);
  });

  it('saves a week’s menu for one meal and your own bowls', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    click('custom');
    click('menu');
    expect(stored().menus).toEqual({ 2: { dinner: [{ mealId: 'seitan-soba-bowl', days: 7 }] } });
    expect(stored().customMeals['custom-a'].parts).toEqual(['soba', 'yuba']);
  });

  it('merges settings changes', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    click('weight');
    expect(stored().settings).toEqual({ startDate: '2026-09-14', unit: 'kg' });
  });

  it('saves a change before the next frame, so closing the tab right away keeps it', async () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    // A native click outside act(): Preact renders in a microtask, but effects wait for the next frame.
    (screen.getByRole('button', { name: 'weight' }) as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(stored().settings.unit).toBe('kg');
  });

  it('keeps working in memory without storage', () => {
    render(<AppStateProvider storage={null}><Probe /></AppStateProvider>);
    expect(screen.getByTestId('persistent').textContent).toBe('false');
    click('weight');
    expect(shown().settings.unit).toBe('kg');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports storage as not persistent once a save fails', () => {
    let failing = false;
    const flaky: StorageLike = {
      getItem: () => null,
      setItem: () => {
        if (failing) throw new Error('QuotaExceededError');
      },
    };
    render(<AppStateProvider storage={flaky}><Probe /></AppStateProvider>);
    expect(screen.getByTestId('persistent').textContent).toBe('true');
    failing = true;
    click('weight');
    expect(screen.getByTestId('persistent').textContent).toBe('false');
  });

  it('reloads saved data when another tab changes it, so saves keep both edits', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...stored(), checks: { 1: { prep: [], shopping: ['seitan'] } } }),
    );
    fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEY }));
    expect(shown().checks[1].shopping).toEqual(['seitan']);
    click('celery');
    expect(stored().checks[1].shopping).toEqual(['seitan', 'celery']);
  });

  it('reloads saved data when the page becomes visible again', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored(), eaten: { me: { '2026-09-14': ['snack'] } } }));
    fireEvent(document, new Event('visibilitychange'));
    expect(shown().eaten).toEqual({ me: { '2026-09-14': ['snack'] } });
  });

  it('does not reload over changes it could not save', () => {
    let failing = false;
    const flaky: StorageLike = {
      getItem: () => null,
      setItem: () => {
        if (failing) throw new Error('QuotaExceededError');
      },
    };
    render(<AppStateProvider storage={flaky}><Probe /></AppStateProvider>);
    failing = true;
    click('weight');
    fireEvent(document, new Event('visibilitychange'));
    expect(shown().settings.unit).toBe('kg');
  });

  it('picks up a new day when the page becomes visible again', () => {
    render(<AppStateProvider><Probe /></AppStateProvider>);
    vi.setSystemTime(new Date(2026, 8, 15, 8));
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByTestId('today').textContent).toBe('2026-09-15');
  });
});
