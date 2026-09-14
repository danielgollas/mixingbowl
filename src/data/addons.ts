import type { AddOn } from './types';

/** Top-up catalogue. Order breaks ties when two add-ons have equal protein per kcal. */
export const ADDONS: AddOn[] = [
  { foodId: 'seitan', stepGrams: 50, maxSteps: 2 },
  { foodId: 'tofu-firm', stepGrams: 50, maxSteps: 2 },
  { foodId: 'tempeh', stepGrams: 50, maxSteps: 2 },
  { foodId: 'edamame', stepGrams: 75, maxSteps: 2 },
];
