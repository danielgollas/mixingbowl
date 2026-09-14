import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, defaultData, load, save, type StorageLike } from './storage';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const TODAY = '2026-09-14';

function storageWith(value: unknown) {
  const s = new MemoryStorage();
  s.setItem(STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
  return s;
}

describe('load', () => {
  it('returns defaults starting today when nothing is stored', () => {
    expect(load(new MemoryStorage(), TODAY)).toEqual(defaultData(TODAY));
    expect(defaultData(TODAY)).toEqual({
      version: 1,
      settings: { startDate: TODAY, targetWeight: null, unit: 'lb' },
      eaten: {},
      shopping: {},
    });
  });

  it('returns defaults for corrupt JSON, wrong version, or no storage', () => {
    expect(load(storageWith('{not json'), TODAY)).toEqual(defaultData(TODAY));
    expect(load(storageWith({ version: 2 }), TODAY)).toEqual(defaultData(TODAY));
    expect(load(storageWith([]), TODAY)).toEqual(defaultData(TODAY));
    expect(load(null, TODAY)).toEqual(defaultData(TODAY));
  });

  it('returns defaults when reading throws', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
    };
    expect(load(throwing, TODAY)).toEqual(defaultData(TODAY));
  });

  it('repairs invalid fields one at a time', () => {
    const data = load(
      storageWith({
        version: 1,
        settings: { startDate: '2026-09-01', targetWeight: 'abc', unit: 'stone' },
        eaten: {
          '2026-09-02': ['breakfast', 'brunch', 'dinner'],
          'not-a-date': ['lunch'],
          '2026-09-03': 'lunch',
        },
        shopping: { spinach: true, celery: 'yes' },
      }),
      TODAY,
    );
    expect(data).toEqual({
      version: 1,
      settings: { startDate: '2026-09-01', targetWeight: null, unit: 'lb' },
      eaten: { '2026-09-02': ['breakfast', 'dinner'] },
      shopping: { spinach: true },
    });
  });

  it('replaces an invalid start date with today', () => {
    const data = load(storageWith({ version: 1, settings: { startDate: '09/01/2026', targetWeight: 150, unit: 'kg' } }), TODAY);
    expect(data.settings).toEqual({ startDate: TODAY, targetWeight: 150, unit: 'kg' });
  });
});

describe('save', () => {
  it('round-trips through load', () => {
    const storage = new MemoryStorage();
    const data = {
      ...defaultData('2026-09-01'),
      settings: { startDate: '2026-09-01', targetWeight: 160, unit: 'lb' as const },
      eaten: { '2026-09-14': ['lunch' as const] },
      shopping: { cabbage: true as const },
    };
    expect(save(storage, data)).toBe(true);
    expect(load(storage, TODAY)).toEqual(data);
  });

  it('returns false when storage is missing or writing throws', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(save(full, defaultData(TODAY))).toBe(false);
    expect(save(null, defaultData(TODAY))).toBe(false);
  });
});
