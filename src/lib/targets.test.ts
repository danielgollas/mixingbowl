import { describe, expect, it } from 'vitest';
import { convertWeight, isValidWeight, proteinTarget } from './targets';

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
