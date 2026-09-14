import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash, type Route } from './router';

const ROUTES: [string, Route][] = [
  ['#/today', { name: 'today' }],
  ['#/week', { name: 'week' }],
  ['#/recipes', { name: 'recipes' }],
  ['#/recipes/crispy-tofu', { name: 'recipe', id: 'crispy-tofu' }],
  ['#/shopping', { name: 'shopping' }],
  ['#/settings', { name: 'settings' }],
];

describe('parseHash', () => {
  it.each(ROUTES)('parses %s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it.each(['', '#', '#/', '#/nope', '#/today/extra', '#/recipes/a/b', 'today'])('rejects %j', (hash) => {
    expect(parseHash(hash)).toBeNull();
  });
});

describe('hrefFor', () => {
  it.each(ROUTES)('builds %s', (hash, route) => {
    expect(hrefFor(route)).toBe(hash);
  });
});
