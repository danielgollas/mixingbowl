import { useEffect } from 'preact/hooks';
import { TabBar } from './components/TabBar';
import type { StorageLike } from './lib/storage';
import { hrefFor, useHashRoute, type Route } from './router';
import { AppStateProvider } from './state';
import { RecipeDetail } from './views/RecipeDetail';
import { Recipes } from './views/Recipes';
import { Settings } from './views/Settings';
import { Shopping } from './views/Shopping';
import { Today } from './views/Today';
import { Week } from './views/Week';

export function App({ storage }: { storage?: StorageLike | null }) {
  return (
    <AppStateProvider storage={storage}>
      <Shell />
    </AppStateProvider>
  );
}

function Shell() {
  const route = useHashRoute();
  const href = hrefFor(route);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
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
    case 'week':
      return <Week />;
    case 'recipes':
      return <Recipes />;
    case 'recipe':
      return <RecipeDetail id={route.id} />;
    case 'shopping':
      return <Shopping />;
    case 'settings':
      return <Settings />;
  }
}
