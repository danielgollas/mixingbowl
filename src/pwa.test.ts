import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import manifestText from '../public/manifest.webmanifest?raw';
import workerScript from '../public/sw.js?raw';
import mainSource from './main.tsx?raw';

const icons = Object.keys(import.meta.glob('../public/icons/*.png'));
const iconExists = (src: string) => icons.includes(`../public/${src}`);

describe('home screen app', () => {
  const manifest = JSON.parse(manifestText) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };

  it('opens full screen at the app root', () => {
    expect(manifest).toMatchObject({
      name: 'Mixing Bowl',
      short_name: 'Mixing Bowl',
      start_url: './',
      scope: './',
      display: 'standalone',
    });
  });

  it('lists icons that exist, including a maskable one', () => {
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) expect(iconExists(icon.src), icon.src).toBe(true);
  });

  it('links the manifest and the iPhone home screen settings from the page', () => {
    const html = indexHtml;
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Mixing Bowl" />');
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes" />');
    expect(iconExists('icons/apple-touch-icon.png')).toBe(true);
  });
});

/* The service worker runs against a fake worker scope: a Map-backed Cache Storage and a scripted network. */
type Handler = (event: FakeEvent) => void;
interface FakeEvent {
  request?: Request;
  respondWith?(response: Promise<Response>): void;
  waitUntil(promise: Promise<unknown>): void;
}

const ORIGIN = 'https://example.github.io';
const SCOPE = `${ORIGIN}/mixingbowl/`;

function worker(network: (request: Request) => Promise<Response>) {
  // Like real Cache Storage, a saved response whose Vary names Origin only matches requests with the same Origin.
  type Entry = { response: Response; origin: string | null };
  type MatchOptions = { ignoreVary?: boolean };
  const stores = new Map<string, Map<string, Entry>>();
  const origin = (r: Request | string) => (typeof r === 'string' ? null : r.headers.get('origin'));
  const open = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    const key = (r: Request | string) => (typeof r === 'string' ? new URL(r, SCOPE).href : r.url);
    return {
      match: async (r: Request | string, options?: MatchOptions) => {
        const entry = store.get(key(r));
        if (!entry) return undefined;
        const varies = /origin/i.test(entry.response.headers.get('vary') ?? '');
        if (varies && !options?.ignoreVary && entry.origin !== origin(r)) return undefined;
        return entry.response.clone();
      },
      put: async (r: Request | string, response: Response) =>
        void store.set(key(r), { response: response.clone(), origin: origin(r) }),
      addAll: async (urls: string[]) => {
        for (const url of urls) store.set(key(url), { response: await network(new Request(key(url))), origin: null });
      },
    };
  };
  const caches = {
    open: async (name: string) => open(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: Request | string, options?: MatchOptions) => {
      for (const name of stores.keys()) {
        const hit = await open(name).match(r, options);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const handlers: Record<string, Handler> = {};
  const self = {
    location: { origin: ORIGIN },
    registration: { scope: SCOPE },
    addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  const fetch = (input: Request | string) => network(typeof input === 'string' ? new Request(input) : input);
  new Function('self', 'caches', 'fetch', workerScript)(self, caches, fetch);

  const lifecycle = async (type: 'install' | 'activate') => {
    const waits: Promise<unknown>[] = [];
    handlers[type]({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  };
  /** The worker's answer, or null when it leaves the request to the browser. */
  const request = async (url: string, init?: RequestInit & { mode?: RequestMode }): Promise<Response | null> => {
    let answer: Promise<Response> | null = null;
    const { mode, ...rest } = init ?? {};
    const req = new Request(url, rest);
    // Only the browser can make a navigate request; mark one by hand.
    if (mode === 'navigate') Object.defineProperty(req, 'mode', { value: 'navigate' });
    handlers.fetch({ request: req, respondWith: (r) => (answer = r), waitUntil: () => undefined });
    return answer;
  };
  return { stores, caches, lifecycle, request };
}

const ok = (body: string) => Promise.resolve(new Response(body, { status: 200 }));
const offline = () => Promise.reject(new TypeError('Failed to fetch'));

describe('service worker', () => {
  it('serves the latest page when online and keeps a copy', async () => {
    let body = 'v1';
    const sw = worker(() => ok(body));
    await sw.lifecycle('install');
    body = 'v2';
    const response = await sw.request(SCOPE, { mode: 'navigate' });
    expect(await response!.text()).toBe('v2');
    expect(await (await sw.caches.match(SCOPE))!.text()).toBe('v2');
  });

  it('opens the saved page offline, on any app route', async () => {
    let online = true;
    const sw = worker((r) => (online ? ok(`page ${new URL(r.url).pathname}`) : offline()));
    await sw.lifecycle('install');
    online = false;
    const response = await sw.request(`${SCOPE}?source=homescreen`, { mode: 'navigate' });
    expect(await response!.text()).toBe('page /mixingbowl/');
  });

  it('saves the files the page links to when it installs, so the first offline launch works', async () => {
    let online = true;
    const page =
      '<link rel="stylesheet" href="/mixingbowl/assets/index-1.css"><script type="module" src="/mixingbowl/assets/index-2.js"></script>' +
      '<link rel="icon" href="data:image/svg+xml,x"><script src="https://cdn.example.com/x.js"></script>';
    const sw = worker((r) => (online ? ok(r.url === SCOPE ? page : `file ${new URL(r.url).pathname}`) : offline()));
    await sw.lifecycle('install');
    online = false;
    expect(await (await sw.request(`${SCOPE}assets/index-1.css`))!.text()).toBe('file /mixingbowl/assets/index-1.css');
    expect(await (await sw.request(`${SCOPE}assets/index-2.js`))!.text()).toBe('file /mixingbowl/assets/index-2.js');
  });

  it('serves saved files offline to requests that send an Origin, even when the server varies on it', async () => {
    let online = true;
    const page = '<script type="module" crossorigin src="/mixingbowl/assets/index-2.js"></script>';
    const sw = worker((r) =>
      online
        ? Promise.resolve(new Response(r.url === SCOPE ? page : 'script', { headers: { Vary: 'Origin' } }))
        : offline(),
    );
    await sw.lifecycle('install');
    online = false;
    const response = await sw.request(`${SCOPE}assets/index-2.js`, { headers: { Origin: ORIGIN } });
    expect(await response!.text()).toBe('script');
  });

  it('serves a saved file without the network, and saves files it fetches', async () => {
    let calls = 0;
    const sw = worker(() => {
      calls++;
      return ok('asset');
    });
    const url = `${SCOPE}assets/index-abc123.js`;
    expect(await (await sw.request(url))!.text()).toBe('asset');
    expect(await (await sw.request(url))!.text()).toBe('asset');
    expect(calls).toBe(1);
  });

  it('leaves other sites, posts and other paths on this site to the browser', async () => {
    const sw = worker(() => ok('x'));
    expect(await sw.request('https://cdn.apple-cloudkit.com/ck/2/cloudkit.js')).toBeNull();
    expect(await sw.request(`${SCOPE}assets/a.js`, { method: 'POST' })).toBeNull();
    expect(await sw.request(`${ORIGIN}/other-project/app.js`)).toBeNull();
  });

  it('does not save failed responses', async () => {
    const sw = worker(() => Promise.resolve(new Response('missing', { status: 404 })));
    await sw.request(`${SCOPE}assets/gone.js`);
    expect(await sw.caches.match(`${SCOPE}assets/gone.js`)).toBeUndefined();
  });

  it('removes caches from older versions when it takes over', async () => {
    const sw = worker(() => ok('x'));
    await sw.caches.open('mixingbowl-old');
    await sw.lifecycle('install');
    await sw.lifecycle('activate');
    expect(await sw.caches.keys()).not.toContain('mixingbowl-old');
    expect((await sw.caches.keys()).length).toBe(1);
  });
});

describe('registration', () => {
  it('registers the worker from the app entry in production builds only', () => {
    const main = mainSource;
    expect(main).toContain("navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)");
    expect(main).toContain('import.meta.env.PROD');
  });
});
