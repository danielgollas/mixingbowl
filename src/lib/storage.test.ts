import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, defaultData, load, parseData, save, type AppData, type StorageLike } from './storage';

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
      version: 3,
      settings: { startDate: TODAY, unit: 'lb' },
      people: [{ id: 'me', name: 'Me', targetWeight: null, meals: ['snack', 'dinner'], scale: true, maintenance: null }],
      activePerson: 'me',
      eaten: {},
      menus: {},
      customMeals: {},
      checks: {},
    });
  });

  it('returns defaults for corrupt JSON, unknown versions, or no storage', () => {
    expect(load(storageWith('{not json'), TODAY)).toEqual(defaultData(TODAY));
    expect(load(storageWith({ version: 4 }), TODAY)).toEqual(defaultData(TODAY));
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

  it('upgrades version 1 into one person, keeping settings and eaten history and dropping shopping checks', () => {
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
      settings: { startDate: '2026-09-01', unit: 'lb' },
      people: [{ id: 'me', name: 'Me', targetWeight: 160, meals: ['snack', 'dinner'], scale: true, maintenance: null }],
      eaten: { me: { '2026-09-02': ['breakfast', 'dinner'] } },
    });
  });

  it('upgrades version 2 into one person, keeping menus, custom bowls and checks', () => {
    const data = load(
      storageWith({
        version: 2,
        settings: { startDate: '2026-09-01', targetWeight: 72.5, unit: 'kg', meals: ['lunch', 'dinner'] },
        eaten: { '2026-09-02': ['lunch'] },
        menus: { '2': { dinner: [{ mealId: 'custom-a', days: 7 }] } },
        customMeals: { 'custom-a': { name: 'Mine', kind: 'bowl', parts: ['quinoa', 'seitan'] } },
        checks: { '2': { prep: ['quinoa'], shopping: [] } },
      }),
      TODAY,
    );
    expect(data).toEqual({
      version: 3,
      settings: { startDate: '2026-09-01', unit: 'kg' },
      people: [{ id: 'me', name: 'Me', targetWeight: 72.5, meals: ['lunch', 'dinner'], scale: true, maintenance: null }],
      activePerson: 'me',
      eaten: { me: { '2026-09-02': ['lunch'] } },
      menus: { '2': { dinner: [{ mealId: 'custom-a', days: 7 }] } },
      customMeals: { 'custom-a': { id: 'custom-a', name: 'Mine', kind: 'bowl', parts: ['quinoa', 'seitan'] } },
      checks: { '2': { prep: ['quinoa'], shopping: [] } },
    });
  });

  it('repairs people one at a time', () => {
    const data = load(
      storageWith({
        version: 3,
        people: [
          { id: 'a', name: '  Ana ', targetWeight: 140, meals: ['dinner'], scale: true, maintenance: null },
          { id: 'a', name: 'Duplicate' },
          { name: 'No id' },
          { id: 'b', name: ' ', targetWeight: -3, meals: ['brunch'], scale: true, maintenance: null },
        ],
        activePerson: 'gone',
        eaten: { a: { '2026-09-02': ['dinner'] }, gone: { '2026-09-02': ['dinner'] }, b: 'x' },
      }),
      TODAY,
    );
    expect(data.people).toEqual([
      { id: 'a', name: 'Ana', targetWeight: 140, meals: ['dinner'], scale: true, maintenance: null },
      { id: 'b', name: 'Person 2', targetWeight: null, meals: ['snack', 'dinner'], scale: true, maintenance: null },
    ]);
    expect(data.activePerson).toBe('a');
    expect(data.eaten).toEqual({ a: { '2026-09-02': ['dinner'] } });
  });

  it('scales portions unless a person has scaling turned off', () => {
    const data = load(
      storageWith({ version: 3, people: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', scale: false, maintenance: null }] }),
      TODAY,
    );
    expect(data.people.map((p) => p.scale)).toEqual([true, false]);
  });

  it('falls back to one default person when none are valid', () => {
    expect(load(storageWith({ version: 3, people: [] }), TODAY).people).toEqual(defaultData(TODAY).people);
  });

  it('repairs invalid settings and eaten entries', () => {
    const data = load(
      storageWith({
        version: 2,
        settings: { startDate: '09/01/2026', targetWeight: 'abc', unit: 'stone', meals: ['dinner', 'brunch', 'lunch'] },
        eaten: { '2026-09-02': ['breakfast', 'brunch'], 'not-a-date': ['lunch'], '2026-09-03': 'lunch' },
      }),
      TODAY,
    );
    expect(data.settings).toEqual({ startDate: TODAY, unit: 'lb' });
    expect(data.people[0]).toEqual({ id: 'me', name: 'Me', targetWeight: null, meals: ['lunch', 'dinner'], scale: true, maintenance: null });
    expect(data.eaten).toEqual({ me: { '2026-09-02': ['breakfast'] } });
  });

  it('keeps valid custom bowls and drops invalid ones', () => {
    const data = load(
      storageWith({
        version: 3,
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
        version: 3,
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
      storageWith({ version: 3, checks: { '1': { prep: ['brown-rice', 'brown-rice', 3], shopping: 'x' }, x: {} } }),
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
      settings: { startDate: '2026-09-01', unit: 'lb' },
      people: [
        { id: 'me', name: 'Me', targetWeight: 160, meals: ['lunch', 'dinner'], scale: true, maintenance: null },
        { id: 'p2', name: 'Alex', targetWeight: null, meals: ['dinner'], scale: true, maintenance: null },
      ],
      activePerson: 'p2',
      eaten: { me: { '2026-09-14': ['lunch'] } },
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

describe('parseData', () => {
  it('reads saved JSON, and returns null for anything that is not data this version can read', () => {
    const data = defaultData(TODAY);
    expect(parseData(JSON.stringify(data), TODAY)).toEqual(data);
    expect(parseData(null, TODAY)).toBeNull();
    expect(parseData('{oops', TODAY)).toBeNull();
    expect(parseData(JSON.stringify({ ...data, version: 4 }), TODAY)).toBeNull();
  });
});

describe('maintenance calories', () => {
  const withMaintenance = (maintenance: unknown) =>
    load(storageWith({ ...defaultData(TODAY), people: [{ id: 'me', name: 'Me', meals: ['dinner'], maintenance }] }), TODAY)
      .people[0].maintenance;

  it('keeps a value in range and drops anything else', () => {
    expect(withMaintenance(2200)).toBe(2200);
    expect(withMaintenance(900)).toBeNull();
    expect(withMaintenance(6000)).toBeNull();
    expect(withMaintenance('2200')).toBeNull();
    expect(withMaintenance(undefined)).toBeNull();
  });

  it('starts empty for new people', () => {
    expect(defaultData(TODAY).people[0].maintenance).toBeNull();
  });
});
