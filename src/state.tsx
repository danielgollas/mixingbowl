import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SLOTS, type Slot } from './data/types';
import { today as currentDate } from './lib/clock';
import {
  STORAGE_KEY,
  browserStorage,
  load,
  save,
  type AppData,
  type Settings,
  type StorageLike,
} from './lib/storage';

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
