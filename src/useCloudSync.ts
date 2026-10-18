import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { today as currentDate } from './lib/clock';
import { parseData, type AppData, type StorageLike } from './lib/storage';
import {
  CloudError,
  EMPTY_META,
  hashData,
  isUntouched,
  placeId,
  readMeta,
  reconcile,
  writeMeta,
  type CloudConnector,
  type CloudSession,
  type Place,
  type SyncMeta,
} from './lib/sync';

export type SyncStatus = 'off' | 'connecting' | 'signed-out' | 'syncing' | 'synced' | 'ask' | 'error';

export interface CloudSync {
  /** 'off' when this build has no iCloud settings. */
  status: SyncStatus;
  signedIn: boolean;
  /** Where the signed-in user's plan lives; null until known. */
  place: Place | null;
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
  /** 'unshared' after the household plan you used stopped being shared. */
  notice: 'unshared' | null;
  /** Shares your own plan; `place.code` then holds the invite code. Throws on failure. */
  share(): Promise<void>;
  /** Stops sharing your plan. Throws on failure. */
  stopSharing(): Promise<void>;
  /** Looks an invite up for the Join page. Throws 'gone' or 'own' CloudErrors. */
  inspect(code: string): Promise<{ owner: string | null }>;
  /** Joins the shared plan and takes it over this browser's. Throws on failure. */
  join(code: string): Promise<void>;
  /** Leaves the shared plan and syncs with your own again. Throws on failure. */
  leave(): Promise<void>;
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
  const [place, setPlace] = useState<Place | null>(null);
  const [notice, setNotice] = useState<'unshared' | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const session = useRef<CloudSession | null>(null);
  const signedInRef = useRef(false);
  const placeRef = useRef<Place | null>(null);
  const statusRef = useRef(status);
  const dataRef = useRef(data);
  dataRef.current = data;
  const running = useRef(false);
  const again = useRef(false);
  const answer = useRef<'cloud' | 'local' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstData = useRef(true);
  /** Set when the household plan disappeared mid-sync: find where the plan lives now, then sync again. */
  const regroup = useRef(false);

  const moveTo = (next: Place | null) => {
    placeRef.current = next;
    setPlace(next);
  };

  /** The saved sync state, or a fresh one when it belongs to a different plan. */
  const metaFor = (where: Place): SyncMeta => {
    const id = placeId(where);
    const saved = readMeta(storage);
    return saved.place === id ? saved : { ...EMPTY_META, place: id };
  };

  const show = (next: SyncStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  /** One sync at a time. `queue` false drops a request made during a sync instead of running it afterwards. */
  const sync = useCallback(
    async (queue = true): Promise<void> => {
      const s = session.current;
      const where = placeRef.current;
      if (!s || !signedInRef.current || !where) return;
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
          const meta = metaFor(where);
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
          // A shared plan is the household's: a device switching to it takes it rather than offering its own.
          if (where.kind === 'member' && meta.tag === null && remote) plan = 'adopt';
          if (plan === 'ask') {
            if (!answer.current) {
              show('ask');
              return;
            }
            plan = answer.current === 'cloud' ? 'adopt' : 'push';
          }
          if (plan === 'adopt' && remote && remoteData) {
            writeMeta(storage, { tag: remote.tag, syncedHash: hashData(remoteData), editedAt: 0, place: meta.place });
            replace(remoteData);
          } else if (plan === 'push') {
            try {
              const saved = await s.save(JSON.stringify(local), remote?.tag ?? null);
              writeMeta(storage, { tag: saved.tag, syncedHash: localHash, editedAt: meta.editedAt, place: meta.place });
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
        if (e instanceof CloudError && e.code === 'gone' && where.kind === 'member') {
          setNotice('unshared');
          regroup.current = true;
        } else {
          setError(messageFor(e));
          show('error');
        }
      } finally {
        running.current = false;
        if (regroup.current) {
          regroup.current = false;
          again.current = false;
          s.place()
            .then((next) => {
              moveTo(next);
              void sync();
            })
            .catch((e: unknown) => {
              setError(messageFor(e));
              show('error');
            });
        } else if (again.current) {
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
      s.place()
        .then((where) => {
          if (!live || !signedInRef.current) return;
          moveTo(where);
          void sync();
        })
        .catch((e: unknown) => {
          if (!live) return;
          setError(messageFor(e));
          show('error');
        });
      void s.whenSignedOut().then(() => {
        if (!live) return;
        signedInRef.current = false;
        setSignedIn(false);
        moveTo(null);
        setNotice(null);
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
    const samePlace = !placeRef.current || meta.place === placeId(placeRef.current);
    if (samePlace && hashData(data) === meta.syncedHash) return;
    if (samePlace && meta.tag !== null) writeMeta(storage, { ...meta, editedAt: Date.now() });
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

  const signedInSession = (): CloudSession => {
    if (!session.current || !signedInRef.current) throw new CloudError('auth', 'Sign in to iCloud first.');
    return session.current;
  };

  /** After moving to another plan: drop any pending question and sync with the new one. */
  const switchPlans = () => {
    answer.current = null;
    setNotice(null);
    setError(null);
    show('syncing');
    void sync();
  };

  return useMemo<CloudSync>(
    () => ({
      status,
      signedIn,
      place,
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
      notice,
      share: async () => {
        const code = await signedInSession().share();
        moveTo({ kind: 'own', code });
        setNotice(null);
      },
      stopSharing: async () => {
        await signedInSession().stopSharing();
        moveTo({ kind: 'own', code: null });
      },
      inspect: async (code) => signedInSession().inspect(code),
      join: async (code) => {
        const s = signedInSession();
        const { owner } = await s.join(code);
        const next = await s.place();
        moveTo(next.kind === 'member' ? { ...next, owner: next.owner ?? owner } : next);
        switchPlans();
      },
      leave: async () => {
        const s = signedInSession();
        await s.leave();
        moveTo(await s.place());
        switchPlans();
      },
    }),
    [status, signedIn, place, notice, lastSynced, error, sync],
  );
}
