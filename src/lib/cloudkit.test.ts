import { describe, expect, it, vi } from 'vitest';
import { RECORD_NAME, RECORD_TYPE, cloudConfig, cloudKitConnector, type CloudKitGlobal } from './cloudkit';
import { CloudError } from './sync';

const config = { container: 'iCloud.test', apiToken: 'token', environment: 'production' as const };

function fakeCloudKit(db: { fetchRecords?: unknown; saveRecords?: unknown }, signedIn = false) {
  const container = {
    privateCloudDatabase: { saveRecordZones: vi.fn(async () => ({ zones: [] })), ...db },
    setUpAuth: vi.fn(async () => (signedIn ? { userRecordName: 'u' } : null)),
    whenUserSignsIn: vi.fn(() => new Promise(() => {})),
    whenUserSignsOut: vi.fn(() => new Promise(() => {})),
  };
  const CloudKit = { configure: vi.fn(), getDefaultContainer: () => container } as unknown as CloudKitGlobal;
  return { CloudKit, container };
}

const record = (json: string, tag = 'tag-1') => ({
  recordName: RECORD_NAME,
  recordChangeTag: tag,
  fields: { plan: { value: json } },
  modified: { timestamp: 1234 },
});

describe('cloudConfig', () => {
  it('needs a container and a token', () => {
    expect(cloudConfig({})).toBeNull();
    expect(cloudConfig({ VITE_CLOUDKIT_CONTAINER: 'iCloud.x' })).toBeNull();
    expect(cloudConfig({ VITE_CLOUDKIT_CONTAINER: ' iCloud.x ', VITE_CLOUDKIT_API_TOKEN: 'abc' })).toEqual({
      container: 'iCloud.x',
      apiToken: 'abc',
      environment: 'production',
    });
    expect(
      cloudConfig({ VITE_CLOUDKIT_CONTAINER: 'c', VITE_CLOUDKIT_API_TOKEN: 't', VITE_CLOUDKIT_ENVIRONMENT: 'development' })
        ?.environment,
    ).toBe('development');
  });
});

describe('cloudKitConnector', () => {
  it('configures the container once with Apple’s buttons', async () => {
    const { CloudKit } = fakeCloudKit({}, true);
    const connect = cloudKitConnector(config, async () => CloudKit);
    const session = await connect();
    expect(await connect()).toBe(session);
    expect(CloudKit.configure).toHaveBeenCalledTimes(1);
    expect(CloudKit.configure).toHaveBeenCalledWith({
      containers: [
        expect.objectContaining({
          containerIdentifier: 'iCloud.test',
          environment: 'production',
          apiTokenAuth: expect.objectContaining({
            apiToken: 'token',
            persist: true,
            signInButton: expect.objectContaining({ id: 'apple-sign-in-button' }),
            signOutButton: expect.objectContaining({ id: 'apple-sign-out-button' }),
          }),
        }),
      ],
    });
    expect(await session.setUpAuth()).toBe(true);
  });

  it('explains a failed setup with Apple’s reason', async () => {
    const { CloudKit, container } = fakeCloudKit({});
    container.setUpAuth.mockRejectedValueOnce({ ckErrorCode: 'AUTHENTICATION_FAILED', reason: 'Check the API token.' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const session = await cloudKitConnector(config, async () => CloudKit)();
    await expect(session.setUpAuth()).rejects.toMatchObject({
      code: 'other',
      message: "Couldn't connect to iCloud. Check the API token.",
    });
  });

  it('retries a failed load on the next call', async () => {
    const { CloudKit } = fakeCloudKit({});
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(CloudKit);
    const connect = cloudKitConnector(config, load);
    await expect(connect()).rejects.toThrow('offline');
    expect(await (await connect()).setUpAuth()).toBe(false);
  });

  it('turns CloudKit errors into conflict, auth and other errors', async () => {
    const saveRecords = vi
      .fn()
      .mockResolvedValueOnce({ hasErrors: true, errors: [{ ckErrorCode: 'CONFLICT' }] })
      .mockRejectedValueOnce({ ckErrorCode: 'EXISTS' })
      .mockRejectedValueOnce({ ckErrorCode: 'AUTHENTICATION_REQUIRED' })
      .mockRejectedValueOnce({ ckErrorCode: 'QUOTA_EXCEEDED', reason: 'Your iCloud is full.' });
    const { CloudKit } = fakeCloudKit({ saveRecords });
    const session = await cloudKitConnector(config, async () => CloudKit)();
    const codeOf = (p: Promise<unknown>) => p.then(() => null, (e: CloudError) => [e.code, e.message]);
    expect((await codeOf(session.save('{}', 't')))?.[0]).toBe('conflict');
    expect((await codeOf(session.save('{}', null)))?.[0]).toBe('conflict');
    expect((await codeOf(session.save('{}', 't')))?.[0]).toBe('auth');
    expect(await codeOf(session.save('{}', 't'))).toEqual(['other', 'Your iCloud is full.']);
  });
});

/* A pretend iCloud with several users: private databases with zones, shares, and each user's shared database. */
interface FakeRecord {
  recordName: string;
  recordType: string;
  recordChangeTag: string;
  fields: Record<string, { value: unknown }>;
  modified: { timestamp: number };
  share?: { recordName: string };
  shortGUID?: string;
  publicPermission?: string;
  forRecord?: { recordName: string };
}
type Zones = Map<string, Map<string, FakeRecord>>;
type ZoneID = { zoneName: string; ownerRecordName?: string };
const fail = (ckErrorCode: string) => Promise.reject({ ckErrorCode, reason: ckErrorCode });

function fakeICloud() {
  let n = 0;
  let clock = 1000;
  const users = new Map<string, { name: string; zones: Zones; joined: Set<string> }>();
  const shares = new Map<string, { owner: string; recordName: string }>();

  const user = (id: string, name = id) => {
    if (!users.has(id)) users.set(id, { name, zones: new Map([['_defaultZone', new Map()]]), joined: new Set() });
    return users.get(id)!;
  };
  const zoneOf = (owner: string, zoneName = '_defaultZone') => user(owner).zones.get(zoneName);
  const shareOf = (owner: string) => [...shares.entries()].find(([, s]) => s.owner === owner);

  /** One user's view of a database: their own private zones, or the zones shared with them. */
  function database(me: string, scope: 'private' | 'shared') {
    const zoneFor = (zoneID?: ZoneID) => {
      if (scope === 'private') return zoneOf(me, zoneID?.zoneName);
      const owner = zoneID?.ownerRecordName ?? '';
      if (!user(me).joined.has(owner) || !shareOf(owner)) return undefined;
      return zoneOf(owner, zoneID?.zoneName);
    };
    return {
      fetchRecords: vi.fn(async (names: string[], options?: { zoneID?: ZoneID }) => {
        const zone = zoneFor(options?.zoneID);
        if (!zone) return fail('ZONE_NOT_FOUND');
        const found = names.map((name) => zone.get(name));
        if (found.some((r) => !r)) return { hasErrors: true, errors: [{ ckErrorCode: 'NOT_FOUND' }], records: [] };
        return { records: found.map((r) => ({ ...r })) };
      }),
      saveRecords: vi.fn(async (records: Partial<FakeRecord>[], options?: { zoneID?: ZoneID }) => {
        const zone = zoneFor(options?.zoneID);
        if (!zone) return fail('ZONE_NOT_FOUND');
        const saved: FakeRecord[] = [];
        for (const r of records) {
          clock += 1000;
          if (r.recordType === 'cloudkit.share') {
            const root = zone.get(r.forRecord!.recordName)!;
            const share: FakeRecord = {
              recordName: `share-${++n}`,
              recordType: 'cloudkit.share',
              recordChangeTag: `t${++n}`,
              fields: r.fields ?? {},
              modified: { timestamp: clock },
              shortGUID: `CODE${n}`,
              publicPermission: r.publicPermission,
            };
            zone.set(share.recordName, share);
            shares.set(share.shortGUID!, { owner: me, recordName: share.recordName });
            zone.set(root.recordName, { ...root, share: { recordName: share.recordName }, recordChangeTag: `t${++n}` });
            saved.push(share);
            continue;
          }
          const existing = zone.get(r.recordName!);
          if ((existing?.recordChangeTag ?? undefined) !== r.recordChangeTag)
            return { hasErrors: true, errors: [{ ckErrorCode: existing ? 'CONFLICT' : 'NOT_FOUND' }] };
          const next: FakeRecord = {
            ...existing,
            recordName: r.recordName!,
            recordType: r.recordType!,
            fields: r.fields!,
            recordChangeTag: `t${++n}`,
            modified: { timestamp: clock },
          };
          zone.set(next.recordName, next);
          saved.push(next);
        }
        return { records: saved };
      }),
      deleteRecords: vi.fn(async (records: { recordName: string }[], options?: { zoneID?: ZoneID }) => {
        const zone = zoneFor(options?.zoneID);
        if (!zone) return fail('ZONE_NOT_FOUND');
        for (const { recordName } of records) {
          const share = zone.get(recordName);
          zone.delete(recordName);
          if (share?.shortGUID) shares.delete(share.shortGUID);
          for (const [name, r] of zone)
            if (r.share?.recordName === recordName) zone.set(name, { ...r, share: undefined, recordChangeTag: `t${++n}` });
        }
        return { records };
      }),
      saveRecordZones: vi.fn(async (zones: ZoneID[]) => {
        for (const z of zones) if (!user(me).zones.has(z.zoneName)) user(me).zones.set(z.zoneName, new Map());
        return { zones: zones.map((zoneID) => ({ zoneID })) };
      }),
      fetchAllRecordZones: vi.fn(async () => ({
        zones: [...user(me).joined]
          .filter((owner) => shareOf(owner))
          .map((owner) => ({ zoneID: { zoneName: 'Household', ownerRecordName: owner } })),
      })),
      deleteRecordZones: vi.fn(async (zoneIDs: ZoneID[]) => {
        for (const z of zoneIDs) user(me).joined.delete(z.ownerRecordName ?? '');
        return { zones: zoneIDs.map((zoneID) => ({ zoneID })) };
      }),
    };
  }

  const info = (code: string) => {
    const share = shares.get(code);
    if (!share) return { hasErrors: true, errors: [{ ckErrorCode: 'NOT_FOUND' }], results: [] };
    return {
      results: [
        {
          zoneID: { zoneName: 'Household', ownerRecordName: share.owner },
          ownerIdentity: { nameComponents: { givenName: user(share.owner).name } },
        },
      ],
    };
  };

  return {
    users,
    shares,
    user,
    zoneOf,
    /** CloudKit JS as seen by one signed-in user. */
    cloudKitFor(me: string, name = me): CloudKitGlobal {
      user(me, name);
      const container = {
        privateCloudDatabase: database(me, 'private'),
        sharedCloudDatabase: database(me, 'shared'),
        setUpAuth: vi.fn(async () => ({ userRecordName: me })),
        whenUserSignsIn: vi.fn(() => new Promise(() => {})),
        whenUserSignsOut: vi.fn(() => new Promise(() => {})),
        fetchRecordInfos: vi.fn(async (codes: string[]) => info(codes[0])),
        acceptShares: vi.fn(async (codes: string[]) => {
          const result = info(codes[0]);
          if (!result.hasErrors) user(me).joined.add(shares.get(codes[0])!.owner);
          return result;
        }),
      };
      return { configure: vi.fn(), getDefaultContainer: () => container } as unknown as CloudKitGlobal;
    },
    /** A plan saved by an older version, outside any zone. */
    seedDefault(owner: string, json: string, timestamp: number) {
      zoneOf(owner)!.set(RECORD_NAME, {
        recordName: RECORD_NAME,
        recordType: RECORD_TYPE,
        recordChangeTag: 'old',
        fields: { plan: { value: json } },
        modified: { timestamp },
      });
    },
  };
}

const sessionFor = async (cloud: ReturnType<typeof fakeICloud>, me: string, name = me) => {
  const session = await cloudKitConnector(config, async () => cloud.cloudKitFor(me, name))();
  await session.setUpAuth();
  await session.place();
  return session;
};
const codeOf = (p: Promise<unknown>) => p.then(() => null, (e: CloudError) => [e.code, e.message]);

describe('your plan in the Household zone', () => {
  it('starts empty, and creates the zone on the first save', async () => {
    const cloud = fakeICloud();
    const session = await sessionFor(cloud, 'me');
    expect(await session.fetch()).toBeNull();
    const saved = await session.save('{"a":1}', null);
    expect(cloud.zoneOf('me', 'Household')?.get(RECORD_NAME)?.fields.plan.value).toBe('{"a":1}');
    expect(await session.fetch()).toEqual(saved);
    expect((await session.save('{"a":2}', saved.tag)).json).toBe('{"a":2}');
    expect((await codeOf(session.save('{"a":3}', saved.tag)))?.[0]).toBe('conflict');
  });

  it('moves a plan saved by an older version into the zone, keeping when it was saved and the original', async () => {
    const cloud = fakeICloud();
    cloud.seedDefault('me', '{"old":true}', 42);
    const session = await sessionFor(cloud, 'me');
    const moved = await session.fetch();
    expect(moved).toMatchObject({ json: '{"old":true}', savedAt: 42 });
    expect(cloud.zoneOf('me', 'Household')?.get(RECORD_NAME)?.recordChangeTag).toBe(moved?.tag);
    expect(cloud.zoneOf('me')?.get(RECORD_NAME)?.recordChangeTag).toBe('old');
    // Later fetches read the zone, not the old copy.
    await session.save('{"new":true}', moved!.tag);
    expect((await session.fetch())?.json).toBe('{"new":true}');
  });
});

describe('sharing your plan', () => {
  const shared = async () => {
    const cloud = fakeICloud();
    const owner = await sessionFor(cloud, 'u1', 'Daniel');
    await owner.save('{"plan":"ours"}', null);
    return { cloud, owner };
  };

  it('creates one share for anyone with the link, and reuses it', async () => {
    const { cloud, owner } = await shared();
    const code = await owner.share();
    expect(cloud.shares.get(code)?.owner).toBe('u1');
    const share = cloud.zoneOf('u1', 'Household')?.get(cloud.shares.get(code)!.recordName);
    expect(share).toMatchObject({ recordType: 'cloudkit.share', publicPermission: 'READ_WRITE' });
    expect(await owner.share()).toBe(code);
    expect(cloud.shares.size).toBe(1);
  });

  it('knows a shared plan is yours and finds its code', async () => {
    const { cloud, owner } = await shared();
    expect(await owner.place()).toEqual({ kind: 'own', code: null });
    const code = await owner.share();
    const again = await sessionFor(cloud, 'u1', 'Daniel');
    expect(await again.place()).toEqual({ kind: 'own', code });
  });

  it('stops sharing', async () => {
    const { cloud, owner } = await shared();
    const code = await owner.share();
    await owner.stopSharing();
    expect(cloud.shares.has(code)).toBe(false);
    expect(await owner.place()).toEqual({ kind: 'own', code: null });
  });

  it('looks an invite up by its code, with the owner’s name', async () => {
    const { cloud, owner } = await shared();
    const code = await owner.share();
    const member = await sessionFor(cloud, 'u2', 'Dana');
    expect(await member.inspect(code)).toEqual({ owner: 'Daniel' });
  });

  it('says when an invite no longer works, or is your own', async () => {
    const { cloud, owner } = await shared();
    const code = await owner.share();
    const member = await sessionFor(cloud, 'u2');
    expect(await codeOf(member.inspect('NOPE'))).toEqual(['gone', 'This invite no longer works. Ask for a new link.']);
    expect(await codeOf(member.join('NOPE'))).toEqual(['gone', 'This invite no longer works. Ask for a new link.']);
    expect(await codeOf(owner.inspect(code))).toEqual(['own', "This is your own plan's invite link."]);
    expect(await codeOf(owner.join(code))).toEqual(['own', "This is your own plan's invite link."]);
  });

  it('joins: reads and writes the owner’s plan, and finds it again on another device', async () => {
    const { cloud, owner } = await shared();
    const code = await owner.share();
    const member = await sessionFor(cloud, 'u2', 'Dana');
    expect(await member.join(code)).toEqual({ owner: 'Daniel' });
    const remote = await member.fetch();
    expect(remote?.json).toBe('{"plan":"ours"}');
    await member.save('{"plan":"edited by Dana"}', remote!.tag);
    expect((await owner.fetch())?.json).toBe('{"plan":"edited by Dana"}');

    const otherDevice = await sessionFor(cloud, 'u2', 'Dana');
    expect(await otherDevice.place()).toEqual({ kind: 'member', ownerId: 'u1', owner: null });
    expect((await otherDevice.fetch())?.json).toBe('{"plan":"edited by Dana"}');
  });

  it('says the plan is gone when the owner stops sharing', async () => {
    const { cloud, owner } = await shared();
    const code = await owner.share();
    const member = await sessionFor(cloud, 'u2');
    await member.join(code);
    await owner.stopSharing();
    expect(await codeOf(member.fetch())).toEqual(['gone', 'This plan is no longer shared with you.']);
    expect(await member.place()).toEqual({ kind: 'own', code: null });
  });

  it('leaves, and goes back to your own plan', async () => {
    const { cloud, owner } = await shared();
    const code = await owner.share();
    const member = await sessionFor(cloud, 'u2');
    await member.save('{"plan":"mine"}', null);
    await member.join(code);
    await member.leave();
    expect(cloud.user('u2').joined.size).toBe(0);
    expect((await member.fetch())?.json).toBe('{"plan":"mine"}');
    expect(await member.place()).toEqual({ kind: 'own', code: null });
  });
});
