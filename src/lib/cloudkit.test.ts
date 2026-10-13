import { describe, expect, it, vi } from 'vitest';
import { RECORD_NAME, RECORD_TYPE, cloudConfig, cloudKitConnector, type CloudKitGlobal } from './cloudkit';
import { CloudError } from './sync';

const config = { container: 'iCloud.test', apiToken: 'token', environment: 'production' as const };

function fakeCloudKit(db: { fetchRecords?: unknown; saveRecords?: unknown }, signedIn = false) {
  const container = {
    privateCloudDatabase: db,
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

  it('fetches the record, or null when there is none', async () => {
    const fetchRecords = vi
      .fn()
      .mockResolvedValueOnce({ records: [record('{"a":1}')] })
      .mockResolvedValueOnce({ hasErrors: true, errors: [{ ckErrorCode: 'NOT_FOUND' }], records: [] })
      .mockRejectedValueOnce({ ckErrorCode: 'NOT_FOUND' });
    const { CloudKit } = fakeCloudKit({ fetchRecords });
    const session = await cloudKitConnector(config, async () => CloudKit)();
    expect(await session.fetch()).toEqual({ json: '{"a":1}', savedAt: 1234, tag: 'tag-1' });
    expect(fetchRecords).toHaveBeenCalledWith([RECORD_NAME]);
    expect(await session.fetch()).toBeNull();
    expect(await session.fetch()).toBeNull();
  });

  it('saves with the change tag, or creates without one', async () => {
    const saveRecords = vi.fn(async () => ({ records: [record('ignored', 'tag-2')] }));
    const { CloudKit } = fakeCloudKit({ saveRecords });
    const session = await cloudKitConnector(config, async () => CloudKit)();
    expect(await session.save('{"b":2}', 'tag-1')).toEqual({ json: '{"b":2}', savedAt: 1234, tag: 'tag-2' });
    expect(saveRecords).toHaveBeenLastCalledWith([
      { recordType: RECORD_TYPE, recordName: RECORD_NAME, recordChangeTag: 'tag-1', fields: { plan: { value: '{"b":2}' } } },
    ]);
    await session.save('{}', null);
    expect(saveRecords).toHaveBeenLastCalledWith([
      { recordType: RECORD_TYPE, recordName: RECORD_NAME, fields: { plan: { value: '{}' } } },
    ]);
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
