/** A new day starts at 4am, so late-night eating (the brief's peak cravings) counts toward the evening before. */
export const DAY_START_HOUR = 4;

/** The plan's current date as "YYYY-MM-DD". Tests control it with vi.setSystemTime. */
export function today(now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - DAY_START_HOUR);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${date}`;
}
