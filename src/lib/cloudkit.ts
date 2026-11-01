import { CloudError, type CloudConnector, type CloudSession, type Place, type RemoteRecord } from './sync';

export const CLOUDKIT_SCRIPT = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';
const SIGN_IN_ORIGIN = 'https://cdn.apple-cloudkit.com';
export const SIGN_IN_BUTTON_ID = 'apple-sign-in-button';
export const SIGN_OUT_BUTTON_ID = 'apple-sign-out-button';
export const RECORD_TYPE = 'AppData';
export const RECORD_NAME = 'mixingbowl';
/** The record's one String field: the whole plan as JSON. */
export const PLAN_FIELD = 'plan';
/** CloudKit only shares records in custom zones, so the plan lives in this one. */
export const ZONE_NAME = 'Household';
const SHARE_TYPE = 'cloudkit.share';

const GONE_INVITE = 'This invite no longer works. Ask for a new link.';
const OWN_INVITE = "This is your own plan's invite link.";
const GONE_PLAN = 'This plan is no longer shared with you.';

export interface CloudConfig {
  container: string;
  apiToken: string;
  environment: 'development' | 'production';
}

type Env = Partial<Record<'VITE_CLOUDKIT_CONTAINER' | 'VITE_CLOUDKIT_API_TOKEN' | 'VITE_CLOUDKIT_ENVIRONMENT', string>>;

/** The CloudKit settings baked into the build, or null when sync isn't set up. */
export function cloudConfig(env: Env = import.meta.env): CloudConfig | null {
  const container = env.VITE_CLOUDKIT_CONTAINER?.trim();
  const apiToken = env.VITE_CLOUDKIT_API_TOKEN?.trim();
  if (!container || !apiToken) return null;
  return {
    container,
    apiToken,
    environment: env.VITE_CLOUDKIT_ENVIRONMENT?.trim() === 'development' ? 'development' : 'production',
  };
}

/* The few parts of CloudKit JS this app uses. */
interface CKError {
  ckErrorCode?: string;
  serverErrorCode?: string;
  reason?: string;
  message?: string;
}
interface ZoneID {
  zoneName: string;
  ownerRecordName?: string;
}
interface CKRecord {
  recordName: string;
  recordType?: string;
  recordChangeTag: string;
  fields: Record<string, { value: unknown } | undefined>;
  modified?: { timestamp: number };
  /** Set on a record that is shared. */
  share?: { recordName: string };
  /** Set on a share record: the code in its link. */
  shortGUID?: string;
}
type Identity = { nameComponents?: { givenName?: string } };
/** One invite's details. Where CloudKit puts them varies, so both places are read. */
interface CKShareInfo extends CKError {
  zoneID?: ZoneID;
  ownerIdentity?: Identity;
  share?: { zoneID?: ZoneID; owner?: { userIdentity?: Identity } };
  rootRecord?: { zoneID?: ZoneID };
}

const zoneOf = (info: CKShareInfo | undefined): ZoneID | undefined =>
  info?.zoneID ?? info?.share?.zoneID ?? info?.rootRecord?.zoneID;
const ownerNameOf = (info: CKShareInfo | undefined): string | null =>
  (info?.ownerIdentity ?? info?.share?.owner?.userIdentity)?.nameComponents?.givenName ?? null;
interface CKResponse {
  hasErrors?: boolean;
  errors?: CKError[];
  records?: CKRecord[];
  zones?: { zoneID: ZoneID }[];
  results?: CKShareInfo[];
}
type Options = { zoneID?: ZoneID };
interface CKDatabase {
  fetchRecords(names: string[], options?: Options): Promise<CKResponse>;
  saveRecords(records: object[], options?: Options): Promise<CKResponse>;
  deleteRecords(records: object[], options?: Options): Promise<CKResponse>;
  saveRecordZones(zones: ZoneID[]): Promise<CKResponse>;
  fetchAllRecordZones(): Promise<CKResponse>;
  deleteRecordZones(zones: ZoneID[]): Promise<CKResponse>;
}
interface CKContainer {
  privateCloudDatabase: CKDatabase;
  sharedCloudDatabase: CKDatabase;
  setUpAuth(): Promise<unknown>;
  whenUserSignsIn(): Promise<unknown>;
  whenUserSignsOut(): Promise<unknown>;
  fetchRecordInfos(codes: string[]): Promise<CKResponse>;
  acceptShares(codes: string[]): Promise<CKResponse>;
}
export interface CloudKitGlobal {
  configure(config: object): unknown;
  getDefaultContainer(): CKContainer;
}

declare global {
  interface Window {
    CloudKit?: CloudKitGlobal;
  }
}

function loadCloudKit(): Promise<CloudKitGlobal> {
  if (window.CloudKit) return Promise.resolve(window.CloudKit);
  return new Promise((resolve, reject) => {
    const ready = () => (window.CloudKit ? resolve(window.CloudKit) : reject(new Error("Couldn't load iCloud.")));
    window.addEventListener('cloudkitloaded', ready, { once: true });
    const script = document.createElement('script');
    script.src = CLOUDKIT_SCRIPT;
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error("Couldn't load iCloud. Check your connection."));
    document.head.append(script);
  });
}

function toCloudError(error: unknown): CloudError {
  const e = (typeof error === 'object' && error !== null ? error : {}) as CKError;
  const code = e.ckErrorCode ?? e.serverErrorCode ?? '';
  const message = e.reason || e.message || 'iCloud returned an error.';
  if (code === 'CONFLICT' || code === 'EXISTS') return new CloudError('conflict', message);
  if (code.startsWith('AUTHENTICATION')) return new CloudError('auth', 'Sign in to iCloud again.');
  return new CloudError('other', message);
}

const ckCode = (error: unknown): string =>
  (typeof error === 'object' && error !== null && ((error as CKError).ckErrorCode ?? (error as CKError).serverErrorCode)) || '';

/** Runs a request; throws CloudKit's own error, whether it was thrown or reported in the response. */
async function call(request: () => Promise<CKResponse>): Promise<CKResponse> {
  const response = await request();
  const error = response.hasErrors ? (response.errors?.[0] ?? {}) : undefined;
  if (error) throw error;
  return response;
}

/** Runs a request and returns its records, or throws a CloudError. These codes come back as an empty list. */
async function records(request: () => Promise<CKResponse>, empty = ['NOT_FOUND']): Promise<CKRecord[]> {
  try {
    return (await call(request)).records ?? [];
  } catch (error) {
    if (empty.includes(ckCode(error))) return [];
    throw toCloudError(error);
  }
}

/** Runs a request against someone else's shared plan; a missing zone or record means sharing stopped. */
async function sharedRecords(request: () => Promise<CKResponse>): Promise<CKRecord[]> {
  try {
    return (await call(request)).records ?? [];
  } catch (error) {
    if (['ZONE_NOT_FOUND', 'NOT_FOUND', 'ACCESS_DENIED'].includes(ckCode(error))) throw new CloudError('gone', GONE_PLAN);
    throw toCloudError(error);
  }
}

function toRemote(record: CKRecord | undefined): RemoteRecord | null {
  const json = record?.fields[PLAN_FIELD]?.value;
  if (!record || typeof json !== 'string') return null;
  return { json, savedAt: record.modified?.timestamp ?? 0, tag: record.recordChangeTag };
}

const readCookie = (name: string): string | null =>
  document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;

/**
 * Keeps the sign-in session where the app can write it too (see `takeSessionFromPopup`). CloudKit's default is
 * a cookie; sessions it saved there before this are still read.
 */
export const browserTokenStore = {
  getToken: (key: string): string | null => localStorage.getItem(`mixingbowl:session:${key}`) ?? readCookie(key),
  putToken(key: string, token: string | null): void {
    if (token === null) localStorage.removeItem(`mixingbowl:session:${key}`);
    else localStorage.setItem(`mixingbowl:session:${key}`, token);
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=`;
  },
};

/**
 * CloudKit takes the first object posted to the page while its sign-in popup is open to be the popup's answer.
 * A browser extension can post one first (React DevTools does, twice a second), and the real answer is then
 * dropped. So listen for Apple's answer here too, and have CloudKit read the session back from the store.
 */
function takeSessionFromPopup(container: CKContainer, containerId: string) {
  window.addEventListener('message', (event) => {
    if (event.origin !== SIGN_IN_ORIGIN) return;
    const session = (event.data as { ckSession?: unknown } | null)?.ckSession;
    if (typeof session !== 'string') return;
    browserTokenStore.putToken(containerId, session);
    void container.setUpAuth().catch(() => undefined);
  });
}

/** Connects to CloudKit once; later calls share the session. A failed connection is retried on the next call. */
export function cloudKitConnector(config: CloudConfig, load: () => Promise<CloudKitGlobal> = loadCloudKit): CloudConnector {
  let session: Promise<CloudSession> | null = null;
  return () => {
    session ??= load()
      .then((CloudKit) => {
        CloudKit.configure({
          services: { authTokenStore: browserTokenStore },
          containers: [
            {
              containerIdentifier: config.container,
              environment: config.environment,
              apiTokenAuth: {
                apiToken: config.apiToken,
                persist: true,
                signInButton: { id: SIGN_IN_BUTTON_ID, theme: 'black' },
                signOutButton: { id: SIGN_OUT_BUTTON_ID, theme: 'black' },
              },
            },
          ],
        });
        const container = CloudKit.getDefaultContainer();
        takeSessionFromPopup(container, config.container);
        return cloudKitSession(container);
      })
      .catch((error: unknown) => {
        session = null;
        throw error;
      });
    return session;
  };
}

const userOf = (identity: unknown): string | null =>
  (typeof identity === 'object' && identity !== null && (identity as { userRecordName?: string }).userRecordName) || null;

const planRecord = (json: string, tag: string | null) => ({
  recordType: RECORD_TYPE,
  recordName: RECORD_NAME,
  ...(tag !== null && { recordChangeTag: tag }),
  fields: { [PLAN_FIELD]: { value: json } },
});

function cloudKitSession(container: CKContainer): CloudSession {
  const mine = container.privateCloudDatabase;
  const theirs = container.sharedCloudDatabase;
  const own: ZoneID = { zoneName: ZONE_NAME };
  /** The signed-in user's record name, to recognise their own invite. */
  let me: string | null = null;
  let zoneReady: Promise<unknown> | null = null;

  const ensureZone = () => {
    zoneReady ??= call(() => mine.saveRecordZones([own])).catch((error: unknown) => {
      zoneReady = null;
      throw toCloudError(error);
    });
    return zoneReady;
  };

  const saveOwn = async (json: string, tag: string | null): Promise<RemoteRecord> => {
    await ensureZone();
    const saved = (await records(() => mine.saveRecords([planRecord(json, tag)], { zoneID: own }), []))[0];
    if (!saved?.recordChangeTag) throw new CloudError('other', 'iCloud didn’t confirm the save.');
    return { json, savedAt: saved.modified?.timestamp ?? Date.now(), tag: saved.recordChangeTag };
  };

  const ownRoot = async () => (await records(() => mine.fetchRecords([RECORD_NAME], { zoneID: own }), ['NOT_FOUND', 'ZONE_NOT_FOUND']))[0];

  const shareRecord = async (root: CKRecord | undefined) => {
    if (!root?.share) return undefined;
    return (await records(() => mine.fetchRecords([root.share!.recordName], { zoneID: own })))[0];
  };

  const addShortGUID = async (root: CKRecord) => {
    const update = { ...planRecord('', root.recordChangeTag), fields: root.fields, createShortGUID: true };
    const saved = (await records(() => mine.saveRecords([update], { zoneID: own }), []))[0];
    if (!saved?.recordChangeTag) throw new CloudError('other', 'iCloud didn’t confirm the save.');
    return saved;
  };

  /** Who owns the invite with this code; throws 'gone' or 'own'. */
  const lookUp = async (code: string) => {
    let info: CKShareInfo | undefined;
    try {
      info = (await call(() => container.fetchRecordInfos([code]))).results?.[0];
    } catch {
      info = undefined;
    }
    const zone = info && !ckCode(info) ? zoneOf(info) : undefined;
    const ownerId = zone?.ownerRecordName;
    if (!ownerId) throw new CloudError('gone', GONE_INVITE);
    if (ownerId === me) throw new CloudError('own', OWN_INVITE);
    return { ownerId, owner: ownerNameOf(info) };
  };

  /** The household plan's zone, as seen from a member's shared database. */
  const sharedZone = (place: Place & { kind: 'member' }): ZoneID => ({ zoneName: ZONE_NAME, ownerRecordName: place.ownerId });

  return {
    setUpAuth: async () => {
      try {
        const identity = await container.setUpAuth();
        me = userOf(identity);
        return Boolean(identity);
      } catch (error) {
        // Failing here means the container, token or allowed origins are wrong, not that the user must sign in.
        console.error('CloudKit setUpAuth failed', error);
        const e = (error ?? {}) as CKError;
        throw new CloudError('other', `Couldn't connect to iCloud. ${e.reason || e.message || ''}`.trim());
      }
    },
    whenSignedIn: function whenSignedIn(): Promise<void> {
      return container.whenUserSignsIn().then(
        (identity) => {
          me = userOf(identity);
        },
        // A failed attempt rejects this wait, and the next sign-in resolves a new one.
        () => whenSignedIn(),
      );
    },
    whenSignedOut: () =>
      container.whenUserSignsOut().then(() => {
        me = null;
      }),
    place: async (): Promise<Place> => {
      const zones = (await call(() => theirs.fetchAllRecordZones()).catch((error: unknown) => {
        throw toCloudError(error);
      })).zones ?? [];
      const shared = zones.find((z) => z.zoneID.zoneName === ZONE_NAME && z.zoneID.ownerRecordName !== me);
      if (shared?.zoneID.ownerRecordName) return { kind: 'member', ownerId: shared.zoneID.ownerRecordName, owner: null };
      const share = await shareRecord(await ownRoot());
      return { kind: 'own', code: share?.shortGUID ?? null };
    },
    fetch: async (place) => {
      if (place.kind === 'member') {
        const zoneID = sharedZone(place);
        return toRemote((await sharedRecords(() => theirs.fetchRecords([RECORD_NAME], { zoneID })))[0]);
      }
      const root = await ownRoot();
      if (root) return toRemote(root);
      // A plan saved before zones: copy it in, keeping its save time so newer-edit-wins still compares fairly.
      const old = toRemote((await records(() => mine.fetchRecords([RECORD_NAME])))[0]);
      if (!old) return null;
      const moved = await saveOwn(old.json, null);
      return { ...moved, savedAt: old.savedAt };
    },
    save: async (place, json, tag) => {
      if (place.kind === 'own') return saveOwn(json, tag);
      const zoneID = sharedZone(place);
      const saved = (await sharedRecords(() => theirs.saveRecords([planRecord(json, tag)], { zoneID })))[0];
      if (!saved?.recordChangeTag) throw new CloudError('other', 'iCloud didn’t confirm the save.');
      return { json, savedAt: saved.modified?.timestamp ?? Date.now(), tag: saved.recordChangeTag };
    },
    share: async () => {
      const root = await ownRoot();
      if (!root) throw new CloudError('other', 'Sync your plan with iCloud before sharing it.');
      const existing = await shareRecord(root);
      if (existing?.shortGUID) return existing.shortGUID;
      // Only a record with a short GUID can be shared, and plans aren't saved with one.
      const shareable = root.shortGUID ? root : await addShortGUID(root);
      const share = {
        recordType: SHARE_TYPE,
        forRecord: { recordName: shareable.recordName, recordChangeTag: shareable.recordChangeTag },
        publicPermission: 'READ_WRITE',
        fields: { 'cloudkit.title': { value: 'Mixing Bowl plan' } },
      };
      const saved = (await records(() => mine.saveRecords([share], { zoneID: own }), [])).find(
        (r) => r.recordType === SHARE_TYPE,
      );
      if (!saved?.shortGUID) throw new CloudError('other', 'iCloud didn’t create the invite link.');
      return saved.shortGUID;
    },
    stopSharing: async () => {
      const share = await shareRecord(await ownRoot());
      if (!share) return;
      await records(() => mine.deleteRecords([{ recordName: share.recordName }], { zoneID: own }));
    },
    inspect: async (code) => ({ owner: (await lookUp(code)).owner }),
    join: async (code) => {
      const { ownerId, owner } = await lookUp(code);
      let accepted: CKShareInfo | undefined;
      try {
        accepted = (await call(() => container.acceptShares([code]))).results?.[0];
      } catch (error) {
        if (['NOT_FOUND', 'ZONE_NOT_FOUND'].includes(ckCode(error))) throw new CloudError('gone', GONE_INVITE);
        throw toCloudError(error);
      }
      if (accepted && ckCode(accepted)) throw new CloudError('gone', GONE_INVITE);
      return { owner, ownerId: zoneOf(accepted)?.ownerRecordName ?? ownerId };
    },
    leave: async (place) => {
      if (place.kind !== 'member') return;
      const zoneID = sharedZone(place);
      try {
        await call(() => theirs.deleteRecordZones([zoneID]));
      } catch (error) {
        // Already gone is as good as left.
        if (!['ZONE_NOT_FOUND', 'NOT_FOUND'].includes(ckCode(error))) throw toCloudError(error);
      }
    },
  };
}
