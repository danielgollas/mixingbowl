import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SLOTS, type Meal, type MenuEntry, type Slot } from './data/types';
import { today as currentDate } from './lib/clock';
import {
  STORAGE_KEY,
  browserStorage,
  load,
  save,
  type AppData,
  type Settings,
  type StorageLike,
  type WeekChecks,
} from './lib/storage';

export interface AppState {
  data: AppData;
  /** Local date "YYYY-MM-DD"; refreshed when the page regains focus. */
  today: string;
  /** False when changes can't be saved in this browser. */
  persistent: boolean;
  toggleEaten(date: string, slot: Slot): void;
  setSettings(changes: Partial<Settings>): void;
  /** Replaces one meal's entries for a program week. */
  setMenu(week: number, slot: Slot, entries: MenuEntry[]): void;
  /** Adds or replaces one of your own bowls. */
  saveCustomMeal(meal: Meal): void;
  togglePrep(week: number, componentId: string): void;
  toggleShopping(week: number, foodId: string): void;
  clearShopping(week: number): void;
}

const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

const AppStateContext = createContext<AppState | null>(null);

interface ProviderProps {
  children: ComponentChildren;
  /** Defaults to the browser's localStorage; pass null to run in memory only. */
  storage?: StorageLike | null;
}

export function AppStateProvider({ children, storage }: ProviderProps) {
  const [store] = useState(() => (storage === undefined ? browserStorage() : storage));
  const [today, setToday] = useState(() => currentDate());
  const [data, setData] = useState(() => load(store, currentDate()));
  const [persistent, setPersistent] = useState(store !== null);
  const lastSaveOk = useRef(false);

  // Layout effects run right after the render instead of after the next frame, so a change is saved even if
  // the tab closes immediately. Runs on the first render too, so a first launch saves its default start date.
  useLayoutEffect(() => {
    lastSaveOk.current = save(store, data);
    setPersistent(lastSaveOk.current);
  }, [store, data]);

  useEffect(() => {
    // Another tab may have saved since this one last read, and saving this tab's stale copy would undo that.
    // Only reload while this tab's own saves succeed; otherwise storage is older than what's on screen.
    const reload = () => {
      if (lastSaveOk.current) setData(load(store, currentDate()));
    };
    const onReturn = () => {
      setToday(currentDate());
      reload();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) reload();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('storage', onStorage);
    };
  }, [store]);

  const value = useMemo<AppState>(
    () => ({
      data,
      today,
      persistent,
      toggleEaten: (date, slot) =>
        setData((d) => {
          const current = d.eaten[date] ?? [];
          const next = SLOTS.filter((s) => (s === slot ? !current.includes(s) : current.includes(s)));
          const eaten = { ...d.eaten };
          if (next.length > 0) eaten[date] = next;
          else delete eaten[date];
          return { ...d, eaten };
        }),
      setSettings: (changes) => setData((d) => ({ ...d, settings: { ...d.settings, ...changes } })),
      setMenu: (week, slot, entries) =>
        setData((d) => ({ ...d, menus: { ...d.menus, [week]: { ...d.menus[week], [slot]: entries } } })),
      saveCustomMeal: (meal) => setData((d) => ({ ...d, customMeals: { ...d.customMeals, [meal.id]: meal } })),
      togglePrep: (week, id) => setData((d) => updateChecks(d, week, (c) => ({ ...c, prep: toggleIn(c.prep, id) }))),
      toggleShopping: (week, id) =>
        setData((d) => updateChecks(d, week, (c) => ({ ...c, shopping: toggleIn(c.shopping, id) }))),
      clearShopping: (week) => setData((d) => updateChecks(d, week, (c) => ({ ...c, shopping: [] }))),
    }),
    [data, today, persistent],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

function updateChecks(data: AppData, week: number, change: (checks: WeekChecks) => WeekChecks): AppData {
  const current = data.checks[week] ?? { prep: [], shopping: [] };
  return { ...data, checks: { ...data.checks, [week]: change(current) } };
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState must be used inside <AppStateProvider>');
  return state;
}
