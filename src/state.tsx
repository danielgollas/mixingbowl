import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SLOTS, type Meal, type MenuEntry, type Slot, type WeekMenu } from './data/types';
import { today as currentDate } from './lib/clock';
import { cloudConfig, cloudKitConnector } from './lib/cloudkit';
import {
  STORAGE_KEY,
  browserStorage,
  load,
  save,
  type AppData,
  MAX_PEOPLE,
  newPerson,
  type Person,
  type Settings,
  type StorageLike,
  type WeekChecks,
} from './lib/storage';
import type { CloudConnector } from './lib/sync';
import { useCloudSync, type CloudSync } from './useCloudSync';

export interface AppState {
  data: AppData;
  /** Local date "YYYY-MM-DD"; refreshed when the page regains focus. */
  today: string;
  /** False when changes can't be saved in this browser. */
  persistent: boolean;
  /** The person Today shows. */
  person: Person;
  /** iCloud sync; status 'off' when this build has no iCloud settings. */
  sync: CloudSync;
  toggleEaten(personId: string, date: string, slot: Slot): void;
  setSettings(changes: Partial<Settings>): void;
  updatePerson(id: string, changes: Partial<Omit<Person, 'id'>>): void;
  addPerson(): void;
  removePerson(id: string): void;
  setActivePerson(id: string): void;
  /** Replaces one meal's entries for a program week. */
  setMenu(week: number, slot: Slot, entries: MenuEntry[]): void;
  /** Replaces a program week's whole menu; null removes it so the week falls back to an earlier one. */
  replaceWeekMenu(week: number, menu: WeekMenu | null): void;
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
  /** Defaults to CloudKit when the build has iCloud settings; pass null to turn sync off. */
  cloud?: CloudConnector | null;
  /** How long after a change to push it, in ms. */
  syncDelay?: number;
}

const config = cloudConfig();
const DEFAULT_CLOUD = config ? cloudKitConnector(config) : null;

export function AppStateProvider({ children, storage, cloud, syncDelay }: ProviderProps) {
  const [store] = useState(() => (storage === undefined ? browserStorage() : storage));
  const [connect] = useState(() => (cloud === undefined ? DEFAULT_CLOUD : cloud));
  const [today, setToday] = useState(() => currentDate());
  const [data, setData] = useState(() => load(store, currentDate()));
  const [persistent, setPersistent] = useState(store !== null);
  const lastSaveOk = useRef(false);
  const sync = useCloudSync({ connect, storage: store, data, replace: setData, delay: syncDelay });

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
      person: data.people.find((p) => p.id === data.activePerson) ?? data.people[0],
      sync,
      toggleEaten: (personId, date, slot) =>
        setData((d) => {
          const log = d.eaten[personId] ?? {};
          const current = log[date] ?? [];
          const next = SLOTS.filter((s) => (s === slot ? !current.includes(s) : current.includes(s)));
          const updated = { ...log };
          if (next.length > 0) updated[date] = next;
          else delete updated[date];
          return { ...d, eaten: { ...d.eaten, [personId]: updated } };
        }),
      setSettings: (changes) => setData((d) => ({ ...d, settings: { ...d.settings, ...changes } })),
      updatePerson: (id, changes) =>
        setData((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...changes } : p)) })),
      addPerson: () =>
        setData((d) => {
          if (d.people.length >= MAX_PEOPLE) return d;
          const id = `person-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          return { ...d, people: [...d.people, newPerson(id, `Person ${d.people.length + 1}`)] };
        }),
      removePerson: (id) =>
        setData((d) => {
          if (d.people.length <= 1) return d;
          const people = d.people.filter((p) => p.id !== id);
          const { [id]: _removed, ...eaten } = d.eaten;
          return { ...d, people, eaten, activePerson: d.activePerson === id ? people[0].id : d.activePerson };
        }),
      setActivePerson: (id) => setData((d) => (d.people.some((p) => p.id === id) ? { ...d, activePerson: id } : d)),
      setMenu: (week, slot, entries) =>
        setData((d) => ({ ...d, menus: { ...d.menus, [week]: { ...d.menus[week], [slot]: entries } } })),
      replaceWeekMenu: (week, menu) =>
        setData((d) => {
          const { [week]: _old, ...menus } = d.menus;
          return { ...d, menus: menu ? { ...menus, [week]: menu } : menus };
        }),
      saveCustomMeal: (meal) => setData((d) => ({ ...d, customMeals: { ...d.customMeals, [meal.id]: meal } })),
      togglePrep: (week, id) => setData((d) => updateChecks(d, week, (c) => ({ ...c, prep: toggleIn(c.prep, id) }))),
      toggleShopping: (week, id) =>
        setData((d) => updateChecks(d, week, (c) => ({ ...c, shopping: toggleIn(c.shopping, id) }))),
      clearShopping: (week) => setData((d) => updateChecks(d, week, (c) => ({ ...c, shopping: [] }))),
    }),
    [data, today, persistent, sync],
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
