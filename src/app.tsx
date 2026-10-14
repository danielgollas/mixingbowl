import { useEffect, useRef } from 'preact/hooks';
import { TabBar } from './components/TabBar';
import type { StorageLike } from './lib/storage';
import type { CloudConnector } from './lib/sync';
import { hrefFor, useHashRoute, type Route } from './router';
import { AppStateProvider } from './state';
import { BowlDetail } from './views/BowlDetail';
import { ComponentDetail } from './views/ComponentDetail';
import { Menu } from './views/Menu';
import { Prep } from './views/Prep';
import { PrintWeek } from './views/PrintWeek';
import { Recipes } from './views/Recipes';
import { Settings } from './views/Settings';
import { Shopping } from './views/Shopping';
import { Today } from './views/Today';

interface AppProps {
  storage?: StorageLike | null;
  cloud?: CloudConnector | null;
  syncDelay?: number;
}

export function App({ storage, cloud, syncDelay }: AppProps) {
  return (
    <AppStateProvider storage={storage} cloud={cloud} syncDelay={syncDelay}>
      <Shell />
    </AppStateProvider>
  );
}

function Shell() {
  const route = useHashRoute();
  const href = hrefFor(route);
  const isFirstRender = useRef(true);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Move keyboard and screen-reader focus to the new page, as a full page load would.
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [href]);

  return (
    <div class="app">
      <main class="content">
        <View route={route} />
      </main>
      <footer class="disclaimer">
        <p>
          This is for informational purposes only. For medical advice or diagnosis, consult a professional. AI
          responses may include mistakes. Nutrition figures are estimates.
        </p>
      </footer>
      <TabBar route={route} />
    </div>
  );
}

function View({ route }: { route: Route }) {
  switch (route.name) {
    case 'today':
      return <Today />;
    case 'menu':
      return <Menu week={route.week} />;
    case 'prep':
      return <Prep week={route.week} />;
    case 'shopping':
      return <Shopping week={route.week} />;
    case 'print':
      return <PrintWeek week={route.week} />;
    case 'recipes':
      return <Recipes />;
    case 'component':
      return <ComponentDetail id={route.id} />;
    case 'bowl':
      return <BowlDetail key={route.id} id={route.id} />;
    case 'settings':
      return <Settings />;
  }
}
