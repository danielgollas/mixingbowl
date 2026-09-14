import { describe, expect, it } from 'vitest';
import { patternTotals } from './nutrition';
import { KCAL_MAX, KCAL_MIN, convertWeight, isValidWeight, proteinTarget, suggestTopUps } from './topups';

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

  it('is 0.8–1.0 g per lb of target weight', () => {
    expect(proteinTarget(160, 'lb')).toEqual({ min: 128, max: 160 });
  });

  it('converts kg to lb first', () => {
    const t = proteinTarget(72.5, 'kg');
    expect(t?.min).toBeCloseTo(72.5 * 2.20462 * 0.8, 5);
    expect(t?.max).toBeCloseTo(72.5 * 2.20462, 5);
  });
});

describe('suggestTopUps', () => {
  it('suggests nothing when the day already meets both floors', () => {
    const result = suggestTopUps({ kcal: 1250, protein: 130 }, 128);
    expect(result.items).toEqual([]);
    expect(result.after).toEqual({ kcal: 1250, protein: 130 });
    expect(result.unmet).toEqual({ kcal: 0, protein: 0 });
  });

  it('closes Pattern A for a 160 lb target with seitan then tofu', () => {
    const result = suggestTopUps(patternTotals('A'), 128);
    expect(result.items.map((i) => [i.foodId, i.grams])).toEqual([
      ['seitan', 100],
      ['tofu-firm', 100],
    ]);
    expect(result.items[0].kcal).toBeCloseTo(130, 5);
    expect(result.items[0].protein).toBeCloseTo(21, 5);
    expect(result.after.kcal).toBeCloseTo(1299.0, 0);
    expect(result.after.protein).toBeCloseTo(128.9, 0);
    expect(result.unmet).toEqual({ kcal: 0, protein: 0 });
  });

  it('only targets the kcal floor when protein target is unknown', () => {
    const result = suggestTopUps(patternTotals('A'), null);
    expect(result.items.map((i) => [i.foodId, i.grams])).toEqual([
      ['seitan', 100],
      ['tofu-firm', 50],
    ]);
    expect(result.after.kcal).toBeGreaterThanOrEqual(KCAL_MIN);
    expect(result.unmet.protein).toBe(0);
  });

  it('never pushes the day over the kcal ceiling', () => {
    const result = suggestTopUps({ kcal: 1450, protein: 50 }, 128);
    expect(result.items).toEqual([]);
    expect(result.unmet.protein).toBeCloseTo(78, 5);
  });

  it('respects max portions and reports what stays unmet', () => {
    const result = suggestTopUps(patternTotals('B'), 144);
    expect(result.items.map((i) => [i.foodId, i.grams])).toEqual([
      ['seitan', 100],
      ['tofu-firm', 100],
      ['tempeh', 100],
      ['edamame', 150],
    ]);
    expect(result.after.kcal).toBeLessThanOrEqual(KCAL_MAX);
    expect(result.unmet.kcal).toBe(0);
    expect(result.unmet.protein).toBeCloseTo(4.5, 0);
  });

  it('stops when every add-on is used up', () => {
    const result = suggestTopUps({ kcal: 0, protein: 0 }, null);
    expect(result.items.map((i) => i.grams)).toEqual([100, 100, 100, 150]);
    expect(result.unmet.kcal).toBeCloseTo(KCAL_MIN - result.after.kcal, 5);
  });
});
