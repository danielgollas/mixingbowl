import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, defaultData, load, save, type AppData, type StorageLike } from './storage';

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
      version: 2,
      settings: { startDate: TODAY, targetWeight: null, unit: 'lb', meals: ['snack', 'dinner'] },
      eaten: {},
      menus: {},
      customMeals: {},
      checks: {},
    });
  });

  it('returns defaults for corrupt JSON, unknown versions, or no storage', () => {
    expect(load(storageWith('{not json'), TODAY)).toEqual(defaultData(TODAY));
    expect(load(storageWith({ version: 3 }), TODAY)).toEqual(defaultData(TODAY));
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

  it('upgrades version 1, keeping settings and eaten history and dropping shopping checks', () => {
    const data = load(
      storageWith({
        version: 1,
        settings: { startDate: '2026-09-01', targetWeight: 160, unit: 'lb' },
        eaten: { '2026-09-02': ['breakfast', 'dinner'] },
        shopping: { spinach: true },
      }),
      TODAY,
    );
    expect(data).toEqual({
      ...defaultData(TODAY),
      settings: { startDate: '2026-09-01', targetWeight: 160, unit: 'lb', meals: ['snack', 'dinner'] },
      eaten: { '2026-09-02': ['breakfast', 'dinner'] },
    });
  });

  it('repairs invalid settings and eaten entries one at a time', () => {
    const data = load(
      storageWith({
        version: 2,
        settings: { startDate: '09/01/2026', targetWeight: 'abc', unit: 'stone', meals: ['dinner', 'brunch', 'lunch'] },
        eaten: { '2026-09-02': ['breakfast', 'brunch'], 'not-a-date': ['lunch'], '2026-09-03': 'lunch' },
      }),
      TODAY,
    );
    expect(data.settings).toEqual({ startDate: TODAY, targetWeight: null, unit: 'lb', meals: ['lunch', 'dinner'] });
    expect(data.eaten).toEqual({ '2026-09-02': ['breakfast'] });
  });

  it('falls back to snack and dinner when no valid meals are saved', () => {
    const data = load(storageWith({ version: 2, settings: { meals: [] } }), TODAY);
    expect(data.settings.meals).toEqual(['snack', 'dinner']);
  });

  it('keeps valid custom bowls and drops invalid ones', () => {
    const data = load(
      storageWith({
        version: 2,
        customMeals: {
          'custom-a': { name: 'Mine', kind: 'bowl', parts: ['quinoa', 'seitan', 'nori'] },
          'custom-b': { name: 'No protein', kind: 'bowl', parts: ['quinoa'] },
          'custom-c': { name: 'Snack', kind: 'snack', parts: ['protein-fluff'] },
          'scramble-bowl': { name: 'Shadow', kind: 'bowl', parts: ['quinoa', 'seitan'] },
        },
      }),
      TODAY,
    );
    expect(data.customMeals).toEqual({
      'custom-a': { id: 'custom-a', name: 'Mine', kind: 'bowl', parts: ['quinoa', 'seitan', 'nori'] },
    });
  });

  it('drops menu entries that are unknown, the wrong kind, badly counted or past 7 days', () => {
    const data = load(
      storageWith({
        version: 2,
        customMeals: { 'custom-a': { name: 'Mine', kind: 'bowl', parts: ['quinoa', 'seitan'] } },
        menus: {
          '2': {
            dinner: [
              { mealId: 'custom-a', days: 3 },
              { mealId: 'gone', days: 1 },
              { mealId: 'protein-fluff', days: 1 },
              { mealId: 'scramble-bowl', days: 1.5 },
              { mealId: 'scramble-bowl', days: 5 },
              { mealId: 'scramble-bowl', days: 4 },
            ],
            snack: 'nope',
          },
          '0': { dinner: [] },
          abc: { dinner: [] },
        },
      }),
      TODAY,
    );
    expect(data.menus).toEqual({
      '2': {
        dinner: [
          { mealId: 'custom-a', days: 3 },
          { mealId: 'scramble-bowl', days: 4 },
        ],
      },
    });
  });

  it('keeps checks per week as unique strings', () => {
    const data = load(
      storageWith({ version: 2, checks: { '1': { prep: ['brown-rice', 'brown-rice', 3], shopping: 'x' }, x: {} } }),
      TODAY,
    );
    expect(data.checks).toEqual({ '1': { prep: ['brown-rice'], shopping: [] } });
  });
});

describe('save', () => {
  it('round-trips through load', () => {
    const storage = new MemoryStorage();
    const data: AppData = {
      ...defaultData('2026-09-01'),
      settings: { startDate: '2026-09-01', targetWeight: 160, unit: 'lb', meals: ['lunch', 'dinner'] },
      eaten: { '2026-09-14': ['lunch'] },
      menus: { '3': { lunch: [{ mealId: 'custom-a', days: 7 }] } },
      customMeals: { 'custom-a': { id: 'custom-a', name: 'Mine', kind: 'bowl', parts: ['soba', 'yuba', 'nori'] } },
      checks: { '3': { prep: ['soba'], shopping: ['yuba'] } },
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
