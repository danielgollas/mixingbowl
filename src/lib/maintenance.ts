/** The answers behind a maintenance estimate. Kept in metric, whatever unit the app is showing. */
export interface Body {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: Activity;
}

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';

export const ACTIVITIES: { id: Activity; label: string; factor: number }[] = [
  { id: 'sedentary', label: 'Mostly sitting, little exercise', factor: 1.2 },
  { id: 'light', label: 'Light exercise 1–3 days a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderate exercise 3–5 days a week', factor: 1.55 },
  { id: 'active', label: 'Hard exercise 6–7 days a week', factor: 1.725 },
  { id: 'very-active', label: 'Physical job or training twice a day', factor: 1.9 },
];

export const BODY_RANGE = {
  weightKg: { min: 30, max: 300 },
  heightCm: { min: 120, max: 230 },
  age: { min: 18, max: 100 },
} as const;

const within = (value: unknown, { min, max }: { min: number; max: number }) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function isValidBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    within(body.weightKg, BODY_RANGE.weightKg) &&
    within(body.heightCm, BODY_RANGE.heightCm) &&
    within(body.age, BODY_RANGE.age) &&
    Number.isInteger(body.age) &&
    (body.sex === 'male' || body.sex === 'female') &&
    ACTIVITIES.some((a) => a.id === body.activity)
  );
}

/** Mifflin-St Jeor resting calories times an activity factor, in kcal/day to the nearest 10. */
export function estimateMaintenance({ weightKg, heightCm, age, sex, activity }: Body): number {
  const resting = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const factor = ACTIVITIES.find((a) => a.id === activity)!.factor;
  return Math.round((resting * factor) / 10) * 10;
}
