// Lets the app open without a connection: pages come from the network when it's there, everything else from the cache.
const CACHE = 'mixingbowl-v1';
const SCOPE = self.registration.scope;

// The page's scripts and styles load before this worker exists, so save them now along with the page.
async function install() {
  const cache = await caches.open(CACHE);
  const response = await fetch(SCOPE);
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(SCOPE, response);
  const files = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], SCOPE).href)
    .filter((url) => url.startsWith(SCOPE) && url !== SCOPE);
  await cache.addAll([...new Set(files)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(install().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

async function save(key, response) {
  if (response.ok) await (await caches.open(CACHE)).put(key, response.clone());
  return response;
}

// Every route is the same page (hash routing), so one saved copy of it serves them all.
async function page(request) {
  try {
    return await save(SCOPE, await fetch(request));
  } catch (error) {
    const saved = await caches.match(SCOPE, { ignoreVary: true });
    if (saved) return saved;
    throw error;
  }
}

// Built files have content hashes in their names, so a saved copy never goes stale.
// Scripts and styles are requested with an Origin header the install-time copies lack; a server's Vary: Origin
// would otherwise hide them.
async function file(request) {
  return (await caches.match(request, { ignoreVary: true })) ?? save(request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : file(request));
});
