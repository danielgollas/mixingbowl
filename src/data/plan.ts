import type { Plan, Slot } from './types';

export const PLAN: Plan = {
  A: {
    breakfast: 'tofu-scramble',
    lunch: 'crispy-tofu-salad',
    snack: 'protein-fluff',
    dinner: 'cabbage-chips',
  },
  B: {
    breakfast: 'berry-smoothie',
    lunch: 'shirataki-stir-fry',
    snack: 'veggie-batons',
    dinner: 'popcorn-cauliflower',
  },
};

export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner & Night Cravings',
};
