import { defaultData, type AppData, type StorageLike } from './storage';

/** The saved copy in the cloud. */
export interface RemoteRecord {
  json: string;
  /** When the server last saved it, in ms. */
  savedAt: number;
  /** Changes whenever the record is saved. */
  tag: string;
}

/** A connection to one cloud account. CloudKit in the app, a fake in tests. */
export interface CloudSession {
  /** Restores a saved sign-in and (re)draws the sign-in or sign-out button. Resolves true when signed in. */
  setUpAuth(): Promise<boolean>;
  /** Resolves the next time the user signs in. */
  whenSignedIn(): Promise<void>;
  /** Resolves the next time the user signs out. */
  whenSignedOut(): Promise<void>;
  /** The saved record, or null if there is none yet. */
  fetch(): Promise<RemoteRecord | null>;
  /** Saves over the record with this change tag, or creates it when the tag is null. Throws a conflict otherwise. */
  save(json: string, tag: string | null): Promise<RemoteRecord>;
}

export type CloudConnector = () => Promise<CloudSession>;

export type CloudErrorCode = 'conflict' | 'auth' | 'other';

export class CloudError extends Error {
  constructor(
    readonly code: CloudErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

/** JSON with object keys sorted, so equal data always gives the same text. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v ?? null)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A short fingerprint of the data (cyrb53), to tell whether it changed since the last sync. */
export function hashData(data: AppData): string {
  const text = stableStringify(data);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** True when the data is what a first launch creates: nothing worth keeping over a cloud copy. */
export const isUntouched = (data: AppData): boolean =>
  hashData(data) === hashData(defaultData(data.settings.startDate));

export const SYNC_KEY = 'mixingbowl:sync';

export interface SyncMeta {
  /** The record's change tag at the last sync; null when this browser has never synced with this account. */
  tag: string | null;
  /** `hashData` of the data at the last sync. */
  syncedHash: string | null;
  /** When this browser last changed the data, in ms. */
  editedAt: number;
}

export const EMPTY_META: SyncMeta = { tag: null, syncedHash: null, editedAt: 0 };

export function readMeta(storage: StorageLike | null): SyncMeta {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(SYNC_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return EMPTY_META;
    const { tag, syncedHash, editedAt } = raw as Record<string, unknown>;
    if (typeof tag !== 'string' || typeof syncedHash !== 'string') return EMPTY_META;
    return { tag, syncedHash, editedAt: typeof editedAt === 'number' && Number.isFinite(editedAt) ? editedAt : 0 };
  } catch {
    return EMPTY_META;
  }
}

export function writeMeta(storage: StorageLike | null, meta: SyncMeta): void {
  try {
    storage?.setItem(SYNC_KEY, JSON.stringify(meta));
  } catch {
    // Without storage the next sync starts over and asks, which is safe.
  }
}

export type SyncPlan = 'none' | 'push' | 'adopt' | 'ask';

export interface ReconcileInput {
  meta: SyncMeta;
  localHash: string;
  localUntouched: boolean;
  /** The fetched record's tag, save time and data hash; null when there's no record. */
  remote: { tag: string; savedAt: number; hash: string } | null;
}

/** Decides what one sync does. */
export function reconcile({ meta, localHash, localUntouched, remote }: ReconcileInput): SyncPlan {
  if (!remote) return 'push';
  if (meta.tag === null) return remote.hash === localHash || localUntouched ? 'adopt' : 'ask';
  const remoteChanged = remote.tag !== meta.tag;
  const localChanged = localHash !== meta.syncedHash;
  if (!remoteChanged) return localChanged ? 'push' : 'none';
  if (!localChanged) return 'adopt';
  return remote.savedAt > meta.editedAt ? 'adopt' : 'push';
}
