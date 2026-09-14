import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'today' }
  | { name: 'week' }
  | { name: 'recipes' }
  | { name: 'recipe'; id: string }
  | { name: 'shopping' }
  | { name: 'settings' };

const PAGES = ['today', 'week', 'recipes', 'shopping', 'settings'] as const;

export const DEFAULT_ROUTE: Route = { name: 'today' };

export function parseHash(hash: string): Route | null {
  const match = /^#\/(.+)$/.exec(hash);
  if (!match) return null;
  const [page, id, ...rest] = match[1].split('/');
  if (rest.length > 0) return null;
  if (page === 'recipes' && id) {
    try {
      return { name: 'recipe', id: decodeURIComponent(id) };
    } catch {
      return null; // malformed escape such as "%"
    }
  }
  if (id !== undefined) return null;
  return (PAGES as readonly string[]).includes(page) ? { name: page as (typeof PAGES)[number] } : null;
}

export const hrefFor = (route: Route): string =>
  route.name === 'recipe' ? `#/recipes/${encodeURIComponent(route.id)}` : `#/${route.name}`;

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
