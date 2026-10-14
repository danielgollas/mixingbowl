import { COMPONENT_LIST, getComponent } from '../data/components';
import { PRESET_MEALS, SLOT_KIND, partsWithRole } from '../data/meals';
import type { Component, ComponentId, Meal, MenuEntry, Role, Slot } from '../data/types';
import type { CustomMeals } from './menu';

/** A source of numbers in [0, 1). `Math.random` in the app, seeded in tests. */
export type Rng = () => number;

/** A small repeatable generator (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

/** Shuffled copy (Fisher–Yates). */
export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The bowl roles in bowl order. */
export const ROLL_ROLES = ['bed', 'protein', 'veg', 'sauce', 'topping'] as const satisfies readonly Role[];

export type Locks = Partial<Record<Role, boolean>>;

const idsFor = (role: Role, from: readonly Component[] = COMPONENT_LIST) =>
  from.filter((c) => c.role === role).map((c) => c.id);

const withRole = (parts: readonly ComponentId[], role: Role) => partsWithRole({ parts } as Meal, role);

/** Puts parts back in bowl order with `role` replaced. */
const replaceRole = (parts: readonly ComponentId[], role: Role, ids: ComponentId[]): ComponentId[] =>
  ROLL_ROLES.flatMap((r) => (r === role ? ids : withRole(parts, r)));

/** `count` different veg at random (all of them when there are fewer). */
export function randomVeg(count: number, rng: Rng, from: readonly Component[] = COMPONENT_LIST): ComponentId[] {
  return shuffle(idsFor('veg', from), rng).slice(0, count);
}

/**
 * A fully random bowl: one bed, protein, sauce and topping, and 1–3 veg. Roles marked in `locks` keep their parts
 * from `current`.
 */
export function rollBowl(current: readonly ComponentId[] | null, locks: Locks, rng: Rng): ComponentId[] {
  return ROLL_ROLES.flatMap((role) => {
    if (current && locks[role]) return withRole(current, role);
    if (role === 'veg') return randomVeg(1 + Math.floor(rng() * 3), rng);
    return [pick(idsFor(role), rng)];
  });
}

/**
 * Re-rolls one role: a different option for a single part (added if the bowl has none), or a new set of the same
 * size for veg. Keeps the parts when there is nothing else to pick.
 */
export function rerollPart(
  parts: readonly ComponentId[],
  role: Role,
  rng: Rng,
  from: readonly Component[] = COMPONENT_LIST,
): ComponentId[] {
  const current = withRole(parts, role);
  if (role === 'veg') {
    const all = idsFor('veg', from);
    const count = Math.max(1, current.length);
    if (all.length <= count) return [...parts];
    // A different set, not the same veg in another order.
    let next = current;
    while (next.length === current.length && next.every((id) => current.includes(id))) next = randomVeg(count, rng, from);
    return replaceRole(parts, 'veg', next);
  }
  const options = idsFor(role, from).filter((id) => !current.includes(id));
  if (options.length === 0) return [...parts];
  return replaceRole(parts, role, [pick(options, rng)]);
}

/** "{Protein} & {Bed} with {Sauce}", without the sauce when there is none. */
export function bowlName(parts: readonly ComponentId[]): string {
  const name = (role: Role) => getComponent(withRole(parts, role)[0] ?? '')?.name;
  const sauce = name('sauce');
  return `${name('protein')} & ${name('bed')}${sauce ? ` with ${sauce}` : ''}`;
}

/** Seven days over `count` items, as evenly as possible with the larger shares first: 3 → [3, 2, 2]. */
export function splitDays(count: number): number[] {
  const n = Math.max(1, Math.min(7, count));
  return Array.from({ length: n }, (_, i) => Math.floor(7 / n) + (i < 7 % n ? 1 : 0));
}

/**
 * A random menu for each slot: `variations` different items of the slot's kind, from presets and your own bowls
 * (every option once when there are fewer), with the week's days split between them.
 */
export function randomWeek(
  slots: readonly Slot[],
  customMeals: CustomMeals,
  variations: number,
  rng: Rng,
): Partial<Record<Slot, MenuEntry[]>> {
  const all = [...PRESET_MEALS, ...Object.values(customMeals)];
  const menu: Partial<Record<Slot, MenuEntry[]>> = {};
  for (const slot of slots) {
    const options = all.filter((m) => m.kind === SLOT_KIND[slot]);
    const chosen = shuffle(options, rng).slice(0, Math.min(variations, 7));
    const days = splitDays(chosen.length);
    menu[slot] = chosen.map((meal, i) => ({ mealId: meal.id, days: days[i] }));
  }
  return menu;
}
