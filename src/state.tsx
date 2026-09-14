import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { SLOTS, type Slot } from './data/types';
import { today as currentDate } from './lib/clock';
import { browserStorage, load, save, type AppData, type Settings, type StorageLike } from './lib/storage';

export interface AppState {
  data: AppData;
  /** Local date "YYYY-MM-DD"; refreshed when the page regains focus. */
  today: string;
  /** False when changes can't be saved in this browser. */
  persistent: boolean;
  toggleEaten(date: string, slot: Slot): void;
  toggleShopping(itemId: string): void;
  clearShopping(): void;
  setSettings(changes: Partial<Settings>): void;
}

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

  // Layout effects run right after the render instead of after the next frame, so a change is saved even if
  // the tab closes immediately. Runs on the first render too, so a first launch saves its default start date.
  useLayoutEffect(() => {
    setPersistent(save(store, data));
  }, [store, data]);

  useEffect(() => {
    const refresh = () => setToday(currentDate());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

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
      toggleShopping: (itemId) =>
        setData((d) => {
          const shopping = { ...d.shopping };
          if (shopping[itemId]) delete shopping[itemId];
          else shopping[itemId] = true;
          return { ...d, shopping };
        }),
      clearShopping: () => setData((d) => ({ ...d, shopping: {} })),
      setSettings: (changes) => setData((d) => ({ ...d, settings: { ...d.settings, ...changes } })),
    }),
    [data, today, persistent],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState must be used inside <AppStateProvider>');
  return state;
}
