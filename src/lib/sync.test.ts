import { describe, expect, it } from 'vitest';
import { defaultData, newPerson } from './storage';
import { EMPTY_META, SYNC_KEY, hashData, isUntouched, readMeta, reconcile, stableStringify, writeMeta, type SyncMeta } from './sync';

describe('stableStringify and hashData', () => {
  it('ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe('{"a":[1,{"d":2}],"b":1}');
    const data = defaultData('2026-10-12');
    const reordered = Object.fromEntries(Object.entries(data).reverse()) as typeof data;
    expect(hashData(reordered)).toBe(hashData(data));
  });

  it('changes when the data changes', () => {
    const data = defaultData('2026-10-12');
    expect(hashData({ ...data, settings: { ...data.settings, unit: 'kg' } })).not.toBe(hashData(data));
  });
});

describe('isUntouched', () => {
  it('is true only for first-launch data', () => {
    const data = defaultData('2026-10-01');
    expect(isUntouched(data)).toBe(true);
    expect(isUntouched({ ...data, people: [...data.people, newPerson('alex', 'Alex')] })).toBe(false);
    expect(isUntouched({ ...data, eaten: { me: { '2026-10-02': ['dinner'] } } })).toBe(false);
  });
});

describe('sync metadata', () => {
  it('round-trips and repairs', () => {
    writeMeta(localStorage, { tag: 't1', syncedHash: 'h', editedAt: 5 });
    expect(readMeta(localStorage)).toEqual({ tag: 't1', syncedHash: 'h', editedAt: 5 });
    localStorage.setItem(SYNC_KEY, '{"tag":"t1","syncedHash":"h","editedAt":"x"}');
    expect(readMeta(localStorage).editedAt).toBe(0);
    localStorage.setItem(SYNC_KEY, '{oops');
    expect(readMeta(localStorage)).toEqual(EMPTY_META);
    expect(readMeta(null)).toEqual(EMPTY_META);
  });
});

describe('reconcile', () => {
  const linked: SyncMeta = { tag: 't1', syncedHash: 'local-0', editedAt: 1000 };
  const remote = (tag: string, savedAt = 500, hash = 'remote') => ({ tag, savedAt, hash });
  const plan = (meta: SyncMeta, localHash: string, r: ReturnType<typeof remote> | null, localUntouched = false) =>
    reconcile({ meta, localHash, localUntouched, remote: r });

  it('pushes when there is no record yet', () => {
    expect(plan(EMPTY_META, 'local-0', null)).toBe('push');
    expect(plan(linked, 'local-0', null)).toBe('push');
  });

  it('asks on the first sync when both sides have different data, unless this browser is untouched', () => {
    expect(plan(EMPTY_META, 'local', remote('t1'))).toBe('ask');
    expect(plan(EMPTY_META, 'local', remote('t1'), true)).toBe('adopt');
    expect(plan(EMPTY_META, 'same', remote('t1', 500, 'same'))).toBe('adopt');
  });

  it('pushes local changes and adopts remote ones', () => {
    expect(plan(linked, 'local-0', remote('t1'))).toBe('none');
    expect(plan(linked, 'local-1', remote('t1'))).toBe('push');
    expect(plan(linked, 'local-0', remote('t2'))).toBe('adopt');
  });

  it('lets the newer side win when both changed', () => {
    expect(plan(linked, 'local-1', remote('t2', 2000))).toBe('adopt');
    expect(plan(linked, 'local-1', remote('t2', 999))).toBe('push');
  });
});
