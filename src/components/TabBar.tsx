import type { JSX } from 'preact';
import { hrefFor, type Route } from '../router';

type Page = Exclude<Route, { name: 'component' }>['name'];

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
    page: 'menu',
    label: 'Menu',
    icon: (
      <>
        <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
        <path d="M8 8.5c0-2 1.5-2 1.5-4M12 8.5c0-2 1.5-2 1.5-4M16 8.5c0-2 1.5-2 1.5-4" />
      </>
    ),
  },
  {
    page: 'prep',
    label: 'Prep',
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 10.5l2 2 3.5-3.5M8 16h8" />
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

const tabHref = (page: Page): string =>
  page === 'menu' || page === 'prep' || page === 'shopping' ? hrefFor({ name: page, week: null }) : hrefFor({ name: page });

export function TabBar({ route }: { route: Route }) {
  const current: Page | null = route.name === 'component' ? null : route.name;
  return (
    <nav class="tabbar" aria-label="Main">
      {TABS.map((tab) => (
        <a
          key={tab.page}
          class="tab"
          href={tabHref(tab.page)}
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
