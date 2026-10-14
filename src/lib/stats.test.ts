import { describe, expect, it } from 'vitest';
import { weekPlan, planInput } from './prep';
import { personWeekStats } from './stats';
import { defaultData, type AppData, type Person } from './storage';

const base = defaultData('2026-09-14');
const me: Person = { ...base.people[0], targetWeight: 160, maintenance: 2000 };
const data: AppData = { ...base, people: [me] };

describe('personWeekStats', () => {
  it('averages the scaled days over the week', () => {
    const days = weekPlan(planInput(data, me), 1);
    const stats = personWeekStats(data, me, 1);
    const kcal = days.reduce((sum, d) => sum + d.total.kcal, 0) / 7;
    expect(stats.average.kcal).toBeCloseTo(kcal, 5);
    expect(stats.average.fiber).toBeCloseTo(days.reduce((sum, d) => sum + d.total.fiber, 0) / 7, 5);
    expect(stats.unplannedDays).toBe(0);
    expect(stats.target).toEqual({ min: 128, max: 160 });
  });

  it('works out the deficit per day and week, and the weight it is worth', () => {
    const stats = personWeekStats(data, me, 1);
    const perDay = 2000 - stats.average.kcal;
    expect(stats.deficit?.perDay).toBeCloseTo(perDay, 5);
    expect(stats.deficit?.perWeek).toBeCloseTo(perDay * 7, 5);
    expect(stats.deficit?.weightPerWeek).toBeCloseTo((perDay * 7) / 3500, 5);
    const metric = { ...data, settings: { ...data.settings, unit: 'kg' as const } };
    expect(personWeekStats(metric, me, 1).deficit?.weightPerWeek).toBeCloseTo((perDay * 7) / 7700, 5);
  });

  it('reports a surplus as a negative deficit, and nothing without maintenance', () => {
    expect(personWeekStats(data, { ...me, maintenance: 1000 }, 1).deficit!.perDay).toBeLessThan(0);
    expect(personWeekStats(data, { ...me, maintenance: null }, 1).deficit).toBeNull();
  });

  it('counts days with nothing planned for one of the person’s meals, and averages over all 7', () => {
    const partial: AppData = { ...data, menus: { 1: { dinner: [{ mealId: 'scramble-bowl', days: 5 }] } } };
    const stats = personWeekStats(partial, me, 1);
    expect(stats.unplannedDays).toBe(2);
    const days = weekPlan(planInput(partial, me), 1);
    expect(stats.average.kcal).toBeCloseTo(days.reduce((sum, d) => sum + d.total.kcal, 0) / 7, 5);
  });
});
