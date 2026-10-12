import { CloudError, type CloudConnector, type CloudSession, type RemoteRecord } from './sync';

export const CLOUDKIT_SCRIPT = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';
export const SIGN_IN_BUTTON_ID = 'apple-sign-in-button';
export const SIGN_OUT_BUTTON_ID = 'apple-sign-out-button';
export const RECORD_TYPE = 'AppData';
export const RECORD_NAME = 'mixingbowl';

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
interface CKRecord {
  recordName: string;
  recordChangeTag: string;
  fields: Record<string, { value: unknown } | undefined>;
  modified?: { timestamp: number };
}
interface CKResponse {
  hasErrors?: boolean;
  errors?: CKError[];
  records?: CKRecord[];
}
interface CKDatabase {
  fetchRecords(names: string[]): Promise<CKResponse>;
  saveRecords(records: object[]): Promise<CKResponse>;
}
interface CKContainer {
  privateCloudDatabase: CKDatabase;
  setUpAuth(): Promise<unknown>;
  whenUserSignsIn(): Promise<unknown>;
  whenUserSignsOut(): Promise<unknown>;
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

/** Runs a request and returns its records, or throws a CloudError. `NOT_FOUND` comes back as an empty list. */
async function records(request: () => Promise<CKResponse>): Promise<CKRecord[]> {
  let response: CKResponse;
  try {
    response = await request();
  } catch (error) {
    if ((error as CKError)?.ckErrorCode === 'NOT_FOUND') return [];
    throw toCloudError(error);
  }
  const error = response.hasErrors ? response.errors?.[0] : undefined;
  if (error?.ckErrorCode === 'NOT_FOUND') return [];
  if (error) throw toCloudError(error);
  return response.records ?? [];
}

function toRemote(record: CKRecord | undefined): RemoteRecord | null {
  const json = record?.fields.json?.value;
  if (!record || typeof json !== 'string') return null;
  return { json, savedAt: record.modified?.timestamp ?? 0, tag: record.recordChangeTag };
}

/** Connects to CloudKit once; later calls share the session. A failed connection is retried on the next call. */
export function cloudKitConnector(config: CloudConfig, load: () => Promise<CloudKitGlobal> = loadCloudKit): CloudConnector {
  let session: Promise<CloudSession> | null = null;
  return () => {
    session ??= load()
      .then((CloudKit) => {
        CloudKit.configure({
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
        return cloudKitSession(CloudKit.getDefaultContainer());
      })
      .catch((error: unknown) => {
        session = null;
        throw error;
      });
    return session;
  };
}

function cloudKitSession(container: CKContainer): CloudSession {
  const db = container.privateCloudDatabase;
  return {
    setUpAuth: async () => {
      try {
        return Boolean(await container.setUpAuth());
      } catch (error) {
        // Failing here means the container, token or allowed origins are wrong, not that the user must sign in.
        console.error('CloudKit setUpAuth failed', error);
        const e = (error ?? {}) as CKError;
        throw new CloudError('other', `Couldn't connect to iCloud. ${e.reason || e.message || ''}`.trim());
      }
    },
    whenSignedIn: () => container.whenUserSignsIn().then(() => undefined),
    whenSignedOut: () => container.whenUserSignsOut().then(() => undefined),
    fetch: async () => toRemote((await records(() => db.fetchRecords([RECORD_NAME])))[0]),
    save: async (json, tag) => {
      const record = {
        recordType: RECORD_TYPE,
        recordName: RECORD_NAME,
        ...(tag !== null && { recordChangeTag: tag }),
        fields: { json: { value: json } },
      };
      const saved = (await records(() => db.saveRecords([record])))[0];
      if (!saved?.recordChangeTag) throw new CloudError('other', 'iCloud didn’t confirm the save.');
      return { json, savedAt: saved.modified?.timestamp ?? Date.now(), tag: saved.recordChangeTag };
    },
  };
}
