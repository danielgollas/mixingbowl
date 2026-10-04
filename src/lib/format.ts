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

const FRACTIONS: [number, string][] = [
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

/** Kitchen quantities: "1½", "⅔", "2¼"; plain decimals when no common fraction is close. */
export function formatQuantity(value: number): string {
  const whole = Math.floor(value + 0.02);
  const rest = value - whole;
  if (rest < 0.02) return String(whole);
  const fraction = FRACTIONS.find(([f]) => Math.abs(rest - f) < 0.02);
  if (fraction) return `${whole === 0 ? '' : whole}${fraction[1]}`;
  return String(Math.round(value * 10) / 10);
}

/** One decimal, dropping ".0": "2.6", "3". */
export const formatDecimal = (value: number): string => String(Math.round(value * 10) / 10);

/** "420 g" (to the nearest 10 g) or "1.2 kg". */
export const formatWeight = (grams: number): string =>
  grams >= 1000 ? `${formatDecimal(grams / 1000)} kg` : `${whole.format(Math.max(10, Math.round(grams / 10) * 10))} g`;
