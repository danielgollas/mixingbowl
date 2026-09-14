import { describe, expect, it } from 'vitest';
import { today } from './clock';

describe('today', () => {
  it('uses the local calendar date during the day', () => {
    expect(today(new Date(2026, 8, 14, 12, 0))).toBe('2026-09-14');
    expect(today(new Date(2026, 8, 14, 23, 59))).toBe('2026-09-14');
  });

  it('counts the small hours toward the evening before, until 4am', () => {
    expect(today(new Date(2026, 8, 15, 0, 20))).toBe('2026-09-14');
    expect(today(new Date(2026, 8, 15, 3, 59))).toBe('2026-09-14');
    expect(today(new Date(2026, 8, 15, 4, 0))).toBe('2026-09-15');
  });

  it('rolls back across month and year boundaries', () => {
    expect(today(new Date(2026, 9, 1, 2, 0))).toBe('2026-09-30');
    expect(today(new Date(2027, 0, 1, 1, 0))).toBe('2026-12-31');
  });
});
