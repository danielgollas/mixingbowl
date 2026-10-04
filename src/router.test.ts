import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash, type Route } from './router';

const ROUTES: [string, Route][] = [
  ['#/today', { name: 'today' }],
  ['#/menu', { name: 'menu', week: null }],
  ['#/menu/3', { name: 'menu', week: 3 }],
  ['#/prep', { name: 'prep', week: null }],
  ['#/prep/12', { name: 'prep', week: 12 }],
  ['#/shopping', { name: 'shopping', week: null }],
  ['#/shopping/1', { name: 'shopping', week: 1 }],
  ['#/components/crispy-tofu', { name: 'component', id: 'crispy-tofu' }],
  ['#/settings', { name: 'settings' }],
];

describe('parseHash', () => {
  it.each(ROUTES)('parses %s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it.each(['', '#', '#/', '#/nope', '#/today/extra', '#/components/a/b', 'today', '#/components/%', '#/menu/0', '#/menu/x', '#/prep/1/2', '#/week', '#/recipes'])('rejects %j', (hash) => {
    expect(parseHash(hash)).toBeNull();
  });
});

describe('hrefFor', () => {
  it.each(ROUTES)('builds %s', (hash, route) => {
    expect(hrefFor(route)).toBe(hash);
  });
});
