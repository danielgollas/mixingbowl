import { formatShortDate } from '../lib/format';
import { programPosition, weekDays } from '../lib/program';
import { hrefFor, type WeekPage } from '../router';
import { useAppState } from '../state';

/** The week to show: the one in the route, else the current program week. */
export function useWeek(routeWeek: number | null): number {
  const { data, today } = useAppState();
  return routeWeek ?? programPosition(data.settings.startDate, today).week;
}

interface Props {
  page: WeekPage;
  title: string;
  week: number;
}

export function WeekHeader({ page, title, week }: Props) {
  const { data, today } = useAppState();
  const { startDate } = data.settings;
  const days = weekDays(startDate, week);
  const isCurrent = programPosition(startDate, today).week === week;

  return (
    <header class="page-header">
      <div class="title-row">
        <h1>{title}</h1>
        <nav class="week-nav" aria-label="Weeks">
          {week > 1 ? (
            <a href={hrefFor({ name: page, week: week - 1 })} aria-label="Previous week">
              ‹
            </a>
          ) : (
            <span aria-hidden="true">‹</span>
          )}
          <a href={hrefFor({ name: page, week: week + 1 })} aria-label="Next week">
            ›
          </a>
        </nav>
      </div>
      <p class="meta">
        <strong>{`Week ${week}`}</strong>
        {` · ${formatShortDate(days[0])} – ${formatShortDate(days[6])}${isCurrent ? ' · this week' : ''}`}
      </p>
    </header>
  );
}
