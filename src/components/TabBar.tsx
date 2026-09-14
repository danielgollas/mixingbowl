import type { JSX } from 'preact';
import { hrefFor, type Route } from '../router';

type Page = Exclude<Route, { name: 'recipe' }>['name'];

const TABS: { page: Page; label: string; icon: JSX.Element }[] = [
  {
    page: 'today',
    label: 'Today',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </>
    ),
  },
  {
    page: 'week',
    label: 'Week',
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    page: 'recipes',
    label: 'Recipes',
    icon: (
      <>
        <path d="M5 4.5h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
        <path d="M5 17.5a3 3 0 0 1 3-3h11M9 8.5h6" />
      </>
    ),
  },
  {
    page: 'shopping',
    label: 'Shopping',
    icon: (
      <>
        <path d="M5.5 8h13l-1.2 12.5H6.7z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </>
    ),
  },
  {
    page: 'settings',
    label: 'Settings',
    icon: (
      <>
        <path d="M4 6h10M20 6h0M4 12h4M14 12h6M4 18h12" />
        <circle cx="17" cy="6" r="2" />
        <circle cx="11" cy="12" r="2" />
        <circle cx="19" cy="18" r="2" />
      </>
    ),
  },
];

export function TabBar({ route }: { route: Route }) {
  const current: Page = route.name === 'recipe' ? 'recipes' : route.name;
  return (
    <nav class="tabbar" aria-label="Main">
      {TABS.map((tab) => (
        <a
          key={tab.page}
          class="tab"
          href={hrefFor({ name: tab.page })}
          aria-current={tab.page === current ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {tab.icon}
          </svg>
          <span>{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}
