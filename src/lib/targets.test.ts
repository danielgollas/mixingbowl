import { describe, expect, it } from 'vitest';
import type { Body } from './maintenance';
import { newPerson, type Person } from './storage';
import { convertWeight, isValidWeight, proteinTarget, KCAL_MAX, KCAL_MIN, calorieRange } from './targets';

describe('weights', () => {
  it('converts between units, rounded to one decimal', () => {
    expect(convertWeight(160, 'lb', 'kg')).toBe(72.6);
    expect(convertWeight(72.6, 'kg', 'lb')).toBe(160.1);
    expect(convertWeight(160, 'lb', 'lb')).toBe(160);
  });

  it('accepts 80–600 lb or the same range in kg (36.3–272.1)', () => {
    expect(isValidWeight(80, 'lb')).toBe(true);
    expect(isValidWeight(79, 'lb')).toBe(false);
    expect(isValidWeight(600, 'lb')).toBe(true);
    expect(isValidWeight(601, 'lb')).toBe(false);
    expect(isValidWeight(36.3, 'kg')).toBe(true);
    expect(isValidWeight(36.2, 'kg')).toBe(false);
    expect(isValidWeight(272.1, 'kg')).toBe(true);
    expect(isValidWeight(272.2, 'kg')).toBe(false);
    expect(isValidWeight(Number.NaN, 'lb')).toBe(false);
  });

  it('keeps converted weights at the edges of the range valid in the new unit', () => {
    for (const [weight, from, to] of [
      [80, 'lb', 'kg'],
      [600, 'lb', 'kg'],
      [36.3, 'kg', 'lb'],
      [272.1, 'kg', 'lb'],
    ] as const) {
      const converted = convertWeight(weight, from, to);
      expect(isValidWeight(converted, to), `${weight} ${from} → ${converted} ${to}`).toBe(true);
    }
  });
});

describe('proteinTarget', () => {
  it('is unknown without a target weight', () => {
    expect(proteinTarget(null, 'lb')).toBeNull();
  });

  it('is 0.7–1.0 g per lb of target weight', () => {
    expect(proteinTarget(160, 'lb')).toEqual({ min: 112, max: 160 });
  });

  it('converts kg to lb first', () => {
    const t = proteinTarget(72.5, 'kg');
    expect(t?.min).toBeCloseTo(72.5 * 2.20462 * 0.7, 5);
    expect(t?.max).toBeCloseTo(72.5 * 2.20462, 5);
  });
});

describe('calorieRange', () => {
  const person = (extra: Partial<Person>): Person => ({ ...newPerson('a', 'A'), ...extra });
  const body: Body = { weightKg: 80, heightCm: 180, age: 35, sex: 'male', activity: 'moderate' };

  it('uses the fixed range until maintenance is known', () => {
    expect(calorieRange(person({}))).toEqual({ min: KCAL_MIN, max: KCAL_MAX });
  });

  it('takes the default 500 kcal deficit from maintenance', () => {
    expect(calorieRange(person({ maintenance: 2700 }))).toEqual({ min: 2200, max: 2350 });
  });

  it('uses the person’s own deficit', () => {
    expect(calorieRange(person({ maintenance: 2700, deficit: 250 }))?.min).toBe(2450);
  });

  it('stops at the floor: 1,200 kcal, or 1,500 for men', () => {
    expect(calorieRange(person({ maintenance: 1600 }))?.min).toBe(1200);
    expect(calorieRange(person({ maintenance: 1900, body }))?.min).toBe(1500);
  });

  it('never targets more than maintenance', () => {
    expect(calorieRange(person({ maintenance: 1300, body }))?.min).toBe(1300);
  });
});
