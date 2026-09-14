const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const formatNumber = (value: number): string => whole.format(value);
export const formatKcal = (kcal: number): string => `${whole.format(kcal)} kcal`;
export const formatGrams = (grams: number): string => `${whole.format(grams)} g`;

function toLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "Monday, September 14" */
export const formatLongDate = (iso: string): string =>
  toLocalDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** "Mon, Sep 14" */
export const formatShortDate = (iso: string): string =>
  toLocalDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
