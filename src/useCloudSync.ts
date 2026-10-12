import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { today as currentDate } from './lib/clock';
import { parseData, type AppData, type StorageLike } from './lib/storage';
import {
  CloudError,
  EMPTY_META,
  hashData,
  isUntouched,
  readMeta,
  reconcile,
  writeMeta,
  type CloudConnector,
  type CloudSession,
} from './lib/sync';

export type SyncStatus = 'off' | 'connecting' | 'signed-out' | 'syncing' | 'synced' | 'ask' | 'error';

export interface CloudSync {
  /** 'off' when this build has no iCloud settings. */
  status: SyncStatus;
  signedIn: boolean;
  /** When the last sync finished, in ms. */
  lastSynced: number | null;
  error: string | null;
  /** Syncs now, or retries connecting after an error. */
  syncNow(): void;
  /** Answers "which plan?" with the cloud copy. */
  keepCloud(): void;
  /** Answers "which plan?" with this browser's copy. */
  keepLocal(): void;
  /** Draws Apple's sign-in or sign-out button into the elements now on the page. */
  drawButtons(): void;
}

export const SYNC_DELAY = 1500;

const NEWER_DATA = 'Your iCloud has a plan saved by a newer version of Mixing Bowl. Reload the page to update.';

const messageFor = (error: unknown) =>
  error instanceof CloudError || error instanceof Error ? error.message : 'Something went wrong with iCloud.';

interface Options {
  connect: CloudConnector | null;
  storage: StorageLike | null;
  data: AppData;
  /** Replaces the app's data with the cloud copy. */
  replace(data: AppData): void;
  delay?: number;
}

export function useCloudSync({ connect, storage, data, replace, delay = SYNC_DELAY }: Options): CloudSync {
  const [status, setStatus] = useState<SyncStatus>(connect ? 'connecting' : 'off');
  const [signedIn, setSignedIn] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const session = useRef<CloudSession | null>(null);
  const signedInRef = useRef(false);
  const statusRef = useRef(status);
  const dataRef = useRef(data);
  dataRef.current = data;
  const running = useRef(false);
  const again = useRef(false);
  const answer = useRef<'cloud' | 'local' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstData = useRef(true);

  const show = (next: SyncStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  /** One sync at a time. `queue` false drops a request made during a sync instead of running it afterwards. */
  const sync = useCallback(
    async (queue = true): Promise<void> => {
      const s = session.current;
      if (!s || !signedInRef.current) return;
      if (statusRef.current === 'ask' && !answer.current) return;
      if (running.current) {
        if (queue) again.current = true;
        return;
      }
      running.current = true;
      clearTimeout(timer.current);
      timer.current = undefined;
      show('syncing');
      try {
        for (let tries = 1; ; tries++) {
          const meta = readMeta(storage);
          const remote = await s.fetch();
          if (!signedInRef.current) return;
          const remoteData = remote ? parseData(remote.json, currentDate()) : null;
          if (remote && !remoteData) throw new Error(NEWER_DATA);
          const local = dataRef.current;
          const localHash = hashData(local);
          let plan = reconcile({
            meta,
            localHash,
            localUntouched: isUntouched(local),
            remote: remote && remoteData && { tag: remote.tag, savedAt: remote.savedAt, hash: hashData(remoteData) },
          });
          if (plan === 'ask') {
            if (!answer.current) {
              show('ask');
              return;
            }
            plan = answer.current === 'cloud' ? 'adopt' : 'push';
          }
          if (plan === 'adopt' && remote && remoteData) {
            writeMeta(storage, { tag: remote.tag, syncedHash: hashData(remoteData), editedAt: 0 });
            replace(remoteData);
          } else if (plan === 'push') {
            try {
              const saved = await s.save(JSON.stringify(local), remote?.tag ?? null);
              writeMeta(storage, { tag: saved.tag, syncedHash: localHash, editedAt: meta.editedAt });
            } catch (e) {
              // Another device saved since the fetch: look again.
              if (e instanceof CloudError && e.code === 'conflict' && tries < 3) continue;
              throw e;
            }
          }
          answer.current = null;
          setError(null);
          setLastSynced(Date.now());
          show('synced');
          return;
        }
      } catch (e) {
        answer.current = null;
        setError(messageFor(e));
        show('error');
      } finally {
        running.current = false;
        if (again.current) {
          again.current = false;
          void sync();
        }
      }
    },
    [storage, replace],
  );

  // Connect, restore any saved sign-in, then follow sign-ins and sign-outs.
  useEffect(() => {
    if (!connect) return;
    let live = true;
    show('connecting');
    const onSignIn = (s: CloudSession) => {
      if (!live) return;
      signedInRef.current = true;
      setSignedIn(true);
      void sync();
      void s.whenSignedOut().then(() => {
        if (!live) return;
        signedInRef.current = false;
        setSignedIn(false);
        writeMeta(storage, EMPTY_META);
        answer.current = null;
        setLastSynced(null);
        setError(null);
        show('signed-out');
        waitForSignIn(s);
      });
    };
    const waitForSignIn = (s: CloudSession) => void s.whenSignedIn().then(() => onSignIn(s));
    connect()
      .then(async (s) => {
        if (!live) return;
        session.current = s;
        const restored = await s.setUpAuth();
        if (!live) return;
        if (restored) onSignIn(s);
        else {
          show('signed-out');
          waitForSignIn(s);
        }
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(messageFor(e));
        show('error');
      });
    return () => {
      live = false;
    };
  }, [connect, attempt, storage, sync]);

  // A change made here: remember when, and push it shortly.
  useEffect(() => {
    if (firstData.current) {
      firstData.current = false;
      return;
    }
    if (!connect) return;
    const meta = readMeta(storage);
    if (hashData(data) === meta.syncedHash) return;
    if (meta.tag !== null) writeMeta(storage, { ...meta, editedAt: Date.now() });
    if (!signedInRef.current || statusRef.current === 'ask') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), delay);
  }, [data]);

  // Pick up other devices' changes on return; push a waiting change before the page goes away.
  useEffect(() => {
    if (!connect) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') void sync(false);
      else if (timer.current !== undefined) void sync();
    };
    const onFocus = () => void sync(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      clearTimeout(timer.current);
    };
  }, [connect, sync]);

  return useMemo<CloudSync>(
    () => ({
      status,
      signedIn,
      lastSynced,
      error,
      syncNow: () => {
        if (signedInRef.current) void sync();
        else setAttempt((n) => n + 1);
      },
      keepCloud: () => {
        answer.current = 'cloud';
        void sync();
      },
      keepLocal: () => {
        answer.current = 'local';
        void sync();
      },
      drawButtons: () => {
        session.current?.setUpAuth().catch(() => undefined);
      },
    }),
    [status, signedIn, lastSynced, error, sync],
  );
}
