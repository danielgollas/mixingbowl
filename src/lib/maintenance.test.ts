import { describe, expect, it } from 'vitest';
import { estimateMaintenance, isValidBody, type Body } from './maintenance';
import { parseData } from './storage';

const body: Body = { weightKg: 80, heightCm: 180, age: 35, sex: 'male', activity: 'moderate' };

describe('estimateMaintenance', () => {
  it('uses Mifflin-St Jeor times activity, to the nearest 10 kcal', () => {
    expect(estimateMaintenance(body)).toBe(2720);
  });

  it('uses the female constant', () => {
    expect(estimateMaintenance({ ...body, sex: 'female', activity: 'sedentary' })).toBe(1910);
  });

  it('rises with activity', () => {
    expect(estimateMaintenance({ ...body, activity: 'very-active' })).toBeGreaterThan(estimateMaintenance(body));
  });
});

describe('isValidBody', () => {
  it('accepts sensible answers and rejects the rest', () => {
    expect(isValidBody(body)).toBe(true);
    for (const bad of [
      { ...body, weightKg: 10 },
      { ...body, heightCm: 40 },
      { ...body, age: 12 },
      { ...body, age: 35.5 },
      { ...body, sex: 'other' },
      { ...body, activity: 'couch' },
      { ...body, weightKg: Number.NaN },
      null,
      'x',
    ])
      expect(isValidBody(bad)).toBe(false);
  });
});

describe('saved answers', () => {
  const person = (extra: object) => ({ id: 'me', name: 'Me', targetWeight: null, meals: ['dinner'], ...extra });
  const load = (extra: object) =>
    parseData(JSON.stringify({ version: 3, people: [person(extra)], activePerson: 'me' }), '2026-11-01')!.people[0];

  it('keeps valid answers', () => {
    expect(load({ body }).body).toEqual(body);
  });

  it('drops bad or missing answers', () => {
    expect(load({ body: { ...body, age: -1 } }).body).toBeUndefined();
    expect(load({}).body).toBeUndefined();
  });
});
