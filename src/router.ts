import { useEffect, useState } from 'preact/hooks';

/** Pages that show one program week; `week` is null for the current week. */
export type WeekPage = 'menu' | 'prep' | 'shopping' | 'print';

export type Route =
  | { name: 'today' }
  | { name: WeekPage; week: number | null }
  | { name: 'component'; id: string }
  | { name: 'bowl'; id: string }
  | { name: 'recipes' }
  | { name: 'settings' };

const WEEK_PAGES: readonly string[] = ['menu', 'prep', 'shopping', 'print'] satisfies WeekPage[];

export const DEFAULT_ROUTE: Route = { name: 'today' };

export function parseHash(hash: string): Route | null {
  const match = /^#\/(.+)$/.exec(hash);
  if (!match) return null;
  const [page, param, ...rest] = match[1].split('/');
  if (rest.length > 0) return null;
  if ((page === 'components' || page === 'bowls') && param) {
    try {
      return { name: page === 'bowls' ? 'bowl' : 'component', id: decodeURIComponent(param) };
    } catch {
      return null; // malformed escape such as "%"
    }
  }
  if (WEEK_PAGES.includes(page)) {
    if (param === undefined) return { name: page as WeekPage, week: null };
    return /^[1-9]\d{0,3}$/.test(param) ? { name: page as WeekPage, week: Number(param) } : null;
  }
  if (param !== undefined) return null;
  return page === 'today' || page === 'settings' || page === 'recipes' ? { name: page } : null;
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'component':
      return `#/components/${encodeURIComponent(route.id)}`;
    case 'bowl':
      return `#/bowls/${encodeURIComponent(route.id)}`;
    case 'menu':
    case 'prep':
    case 'shopping':
    case 'print':
      return route.week === null ? `#/${route.name}` : `#/${route.name}/${route.week}`;
    default:
      return `#/${route.name}`;
  }
}

/** Hash navigation adds history entries, so a Back link returns to whichever page linked here. */
export const goBack = (event: Event) => {
  if (history.length > 1) {
    event.preventDefault();
    history.back();
  }
};

/** Current hash route. Hash routing keeps deep links working on GitHub Pages, which has no SPA fallback. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));

  useEffect(() => {
    const sync = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (!route) history.replaceState(null, '', hrefFor(DEFAULT_ROUTE));
  }, [route]);

  return route ?? DEFAULT_ROUTE;
}
