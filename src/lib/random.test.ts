import { describe, expect, it } from 'vitest';
import { COMPONENT_LIST, getComponent } from '../data/components';
import { PRESET_MEALS, isValidMeal, partsWithRole } from '../data/meals';
import { findMeal } from './menu';
import type { ComponentId, Meal, Role } from '../data/types';
import { bowlName, pick, randomVeg, randomWeek, rerollPart, rollBowl, seeded, splitDays } from './random';

const asMeal = (parts: ComponentId[]): Meal => ({ id: 'x', name: 'X', kind: 'bowl', parts });
const roleOf = (id: ComponentId) => getComponent(id)!.role;

describe('seeded and pick', () => {
  it('repeats for the same seed and stays in range', () => {
    const a = seeded(7);
    const b = seeded(7);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(pick(['a', 'b', 'c'], () => 0.99)).toBe('c');
  });
});

describe('rollBowl', () => {
  it('always rolls a valid bowl with 1–3 different veg', () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const parts = rollBowl(null, {}, rng);
      expect(isValidMeal(asMeal(parts)), parts.join()).toBe(true);
      const veg = partsWithRole(asMeal(parts), 'veg');
      expect(veg.length).toBeGreaterThanOrEqual(1);
      expect(veg.length).toBeLessThanOrEqual(3);
      expect(partsWithRole(asMeal(parts), 'sauce')).toHaveLength(1);
      expect(partsWithRole(asMeal(parts), 'topping')).toHaveLength(1);
    }
  });

  it('keeps locked parts', () => {
    const rng = seeded(2);
    const first = rollBowl(null, {}, rng);
    for (let i = 0; i < 30; i++) {
      const next = rollBowl(first, { protein: true, veg: true }, rng);
      expect(partsWithRole(asMeal(next), 'protein')).toEqual(partsWithRole(asMeal(first), 'protein'));
      expect(partsWithRole(asMeal(next), 'veg')).toEqual(partsWithRole(asMeal(first), 'veg'));
    }
  });
});

describe('rerollPart', () => {
  const start = ['brown-rice', 'tofu-scramble', 'spinach-mushroom', 'spicy-mayo', 'sesame-seeds'];

  it('changes only that part, always to a different option', () => {
    const rng = seeded(3);
    for (const role of ['bed', 'protein', 'sauce', 'topping'] as Role[]) {
      for (let i = 0; i < 20; i++) {
        const next = rerollPart(start, role, rng);
        const before = partsWithRole(asMeal(start), role);
        const after = partsWithRole(asMeal(next), role);
        expect(after).toHaveLength(1);
        expect(after[0]).not.toBe(before[0]);
        expect(next.filter((id) => roleOf(id) !== role)).toEqual(start.filter((id) => roleOf(id) !== role));
      }
    }
  });

  it('adds a sauce or topping to a bowl that has none', () => {
    const next = rerollPart(['brown-rice', 'tofu-scramble'], 'sauce', seeded(4));
    expect(partsWithRole(asMeal(next), 'sauce')).toHaveLength(1);
  });

  it('keeps the part when its role has only one option', () => {
    const only = COMPONENT_LIST.filter((c) => c.role === 'protein').slice(0, 1);
    const next = rerollPart(['brown-rice', only[0].id], 'protein', seeded(5), only);
    expect(next).toEqual(['brown-rice', only[0].id]);
  });

  it('re-rolls veg as a new set of the same size', () => {
    const parts = ['brown-rice', 'tofu-scramble', 'spinach-mushroom', 'smashed-cucumber'];
    const next = rerollPart(parts, 'veg', seeded(6));
    const veg = partsWithRole(asMeal(next), 'veg');
    expect(veg).toHaveLength(2);
    expect(new Set(veg).size).toBe(2);
    expect(veg).not.toEqual(['spinach-mushroom', 'smashed-cucumber']);
  });
});

describe('randomVeg', () => {
  it('picks different veg, never more than exist', () => {
    const veg = randomVeg(3, seeded(8));
    expect(new Set(veg).size).toBe(3);
    expect(veg.every((id) => roleOf(id) === 'veg')).toBe(true);
    expect(randomVeg(99, seeded(8)).length).toBe(COMPONENT_LIST.filter((c) => c.role === 'veg').length);
  });
});

describe('bowlName', () => {
  it('names a bowl after its protein, bed and sauce', () => {
    expect(bowlName(['brown-rice', 'tofu-scramble', 'spicy-mayo'])).toBe(
      `${getComponent('tofu-scramble')!.name} & ${getComponent('brown-rice')!.name} with ${getComponent('spicy-mayo')!.name}`,
    );
    expect(bowlName(['brown-rice', 'tofu-scramble'])).toBe(
      `${getComponent('tofu-scramble')!.name} & ${getComponent('brown-rice')!.name}`,
    );
  });
});

describe('splitDays', () => {
  it('spreads 7 days as evenly as possible, larger shares first', () => {
    expect(splitDays(1)).toEqual([7]);
    expect(splitDays(2)).toEqual([4, 3]);
    expect(splitDays(3)).toEqual([3, 2, 2]);
    expect(splitDays(4)).toEqual([2, 2, 2, 1]);
  });
});

describe('randomWeek', () => {
  it('gives each meal different items of the right kind that fill the week', () => {
    const rng = seeded(9);
    for (let i = 0; i < 30; i++) {
      const menu = randomWeek(['snack', 'dinner'], {}, 3, rng);
      for (const slot of ['snack', 'dinner'] as const) {
        const entries = menu[slot]!;
        expect(entries.map((e) => e.days)).toEqual([3, 2, 2]);
        expect(new Set(entries.map((e) => e.mealId)).size).toBe(3);
        for (const e of entries) expect(findMeal(e.mealId, {})?.kind).toBe(slot === 'snack' ? 'snack' : 'bowl');
      }
    }
  });

  it('includes your own bowls', () => {
    const mine: Meal = { id: 'custom-1', name: 'Mine', kind: 'bowl', parts: ['brown-rice', 'tofu-scramble'] };
    const rng = seeded(10);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) for (const e of randomWeek(['dinner'], { [mine.id]: mine }, 4, rng).dinner!) seen.add(e.mealId);
    expect(seen.has('custom-1')).toBe(true);
  });

  it('uses every option once when there are fewer than asked', () => {
    const snacks = PRESET_MEALS.filter((m) => m.kind === 'snack').length;
    const entries = randomWeek(['snack'], {}, snacks + 2, seeded(11)).snack!;
    expect(entries).toHaveLength(Math.min(snacks, 7));
    expect(entries.reduce((sum, e) => sum + e.days, 0)).toBe(7);
  });
});
