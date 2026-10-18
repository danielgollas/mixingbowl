import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { today } from './lib/clock';
import { STORAGE_KEY, defaultData, newPerson, type AppData } from './lib/storage';
import { CloudError, EMPTY_META, SYNC_KEY, hashData, readMeta, type CloudSession, type Place, type RemoteRecord } from './lib/sync';

/** Invites: 'HOUSE' is Daniel's, 'MINE' is your own, anything else no longer works. */
function invite(code: string): { owner: string | null } {
  if (code === 'HOUSE') return { owner: 'Daniel' };
  if (code === 'MINE') throw new CloudError('own', "This is your own plan's invite link.");
  throw new CloudError('gone', 'This invite no longer works. Ask for a new link.');
}

/** A pretend iCloud account. */
function fakeCloud({ signedIn = false } = {}) {
  let n = 0;
  let onSignIn: (() => void) | null = null;
  let onSignOut: (() => void) | null = null;
  const cloud = {
    signedIn,
    /** Your own plan and the household plan you joined. `record` is whichever the session is using. */
    slots: { own: null as RemoteRecord | null, shared: null as RemoteRecord | null },
    get record(): RemoteRecord | null {
      return cloud.place.kind === 'own' ? cloud.slots.own : cloud.slots.shared;
    },
    set record(value: RemoteRecord | null) {
      if (cloud.place.kind === 'own') cloud.slots.own = value;
      else cloud.slots.shared = value;
    },
    place: { kind: 'own', code: null } as Place,
    /** The owner stopped sharing. */
    sharedGone: false,
    session: {
      setUpAuth: vi.fn(async (): Promise<boolean> => cloud.signedIn),
      whenSignedIn: () => new Promise<void>((resolve) => (onSignIn = resolve)),
      whenSignedOut: () => new Promise<void>((resolve) => (onSignOut = resolve)),
      fetch: vi.fn(async (where: Place): Promise<RemoteRecord | null> => {
        if (where.kind === 'member' && cloud.sharedGone)
          throw new CloudError('gone', 'This plan is no longer shared with you.');
        return cloud.slots[where.kind === 'own' ? 'own' : 'shared'];
      }),
      save: vi.fn(async (where: Place, json: string, tag: string | null): Promise<RemoteRecord> => {
        const slot = where.kind === 'own' ? 'own' : 'shared';
        if ((cloud.slots[slot]?.tag ?? null) !== tag) throw new CloudError('conflict', 'Conflict');
        cloud.slots[slot] = { json, savedAt: Date.now(), tag: `t${++n}` };
        return cloud.slots[slot]!;
      }),
      place: vi.fn(async (): Promise<Place> => {
        if (cloud.place.kind === 'member' && cloud.sharedGone) cloud.place = { kind: 'own', code: null };
        // A device that finds the shared plan by itself doesn't learn the owner's name.
        return cloud.place.kind === 'member' ? { ...cloud.place, owner: null } : cloud.place;
      }),
      share: vi.fn(async (): Promise<string> => {
        cloud.place = { kind: 'own', code: 'CODE1' };
        return 'CODE1';
      }),
      stopSharing: vi.fn(async (): Promise<void> => {
        cloud.place = { kind: 'own', code: null };
      }),
      inspect: vi.fn(async (code: string): Promise<{ owner: string | null }> => invite(code)),
      join: vi.fn(async (code: string): Promise<{ owner: string | null; ownerId: string }> => {
        const found = invite(code);
        cloud.place = { kind: 'member', ownerId: 'u1', owner: found.owner };
        return { ...found, ownerId: 'u1' };
      }),
      leave: vi.fn(async (_where: Place): Promise<void> => {
        cloud.place = { kind: 'own', code: null };
      }),
    } satisfies CloudSession,
    connect: () => Promise.resolve(cloud.session),
    signIn(): void {
      cloud.signedIn = true;
      onSignIn?.();
    },
    signOut(): void {
      cloud.signedIn = false;
      onSignOut?.();
    },
    /** Another device saves this data. */
    saveElsewhere(data: AppData, savedAt = Date.now()): void {
      cloud.record = { json: JSON.stringify(data), savedAt, tag: `t${++n}` };
    },
    data: (): AppData => JSON.parse(cloud.record!.json),
  };
  return cloud;
}

const fresh = () => defaultData(today());
const withAlex = (): AppData => {
  const data = fresh();
  return { ...data, people: [...data.people, newPerson('alex', 'Alex')] };
};
const edited = (): AppData => {
  const data = fresh();
  return { ...data, people: [{ ...data.people[0], targetWeight: 160 }] };
};
const stored = (): AppData => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

function renderSettings(cloud: ReturnType<typeof fakeCloud> | null, local?: AppData, syncDelay = 0) {
  if (local) localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
  history.replaceState(null, '', '#/settings');
  return render(<App cloud={cloud?.connect ?? null} syncDelay={syncDelay} />);
}

const card = () => screen.queryByRole('region', { name: 'iCloud sync' });
const synced = () => waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Synced with iCloud/));

describe('iCloud sync', () => {
  it('stays hidden when the build has no iCloud settings', () => {
    renderSettings(null);
    expect(card()).toBeNull();
    expect(screen.getByText(/Everything you save stays in this browser\./)).toBeTruthy();
  });

  it('shows Apple’s sign-in button when signed out', async () => {
    const cloud = fakeCloud();
    renderSettings(cloud);
    expect(card()?.textContent).toContain('Connecting to iCloud…');
    await waitFor(() => expect(card()?.textContent).toContain('Sign in with your Apple ID'));
    expect(document.getElementById('apple-sign-in-button')).toBeTruthy();
    // Once to restore a sign-in, once more to draw the button into the card.
    await waitFor(() => expect(cloud.session.setUpAuth).toHaveBeenCalledTimes(2));
    expect(cloud.session.fetch).not.toHaveBeenCalled();
  });

  it('saves this browser’s plan on the first sign-in when iCloud has none', async () => {
    const cloud = fakeCloud();
    renderSettings(cloud, edited());
    await waitFor(() => expect(document.getElementById('apple-sign-in-button')).toBeTruthy());
    cloud.signIn();
    await synced();
    expect(cloud.data()).toEqual(stored());
    expect(readMeta(localStorage).tag).toBe(cloud.record?.tag);
    expect(document.getElementById('apple-sign-out-button')).toBeTruthy();
    expect(document.getElementById('apple-sign-in-button')).toBeNull();
  });

  it('takes iCloud’s plan when this browser has nothing of its own', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, fresh());
    await synced();
    expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']);
    expect(screen.getByRole('article', { name: 'Alex' })).toBeTruthy();
    expect(cloud.session.save).not.toHaveBeenCalled();
  });

  it('asks which plan to keep when both have different plans, and can keep iCloud’s', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, edited());
    await screen.findByText(/Your iCloud already has a Mixing Bowl plan/);
    expect(stored().people[0].targetWeight).toBe(160);
    fireEvent.click(screen.getByRole('button', { name: "Use iCloud's plan" }));
    await synced();
    expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']);
    expect(cloud.session.save).not.toHaveBeenCalled();
  });

  it('can keep this browser’s plan instead', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, edited());
    fireEvent.click(await screen.findByRole('button', { name: "Use this browser's plan" }));
    await synced();
    expect(cloud.data().people.map((p) => p.targetWeight)).toEqual([160]);
    expect(stored().people).toHaveLength(1);
  });

  it('pushes changes made here', async () => {
    const cloud = fakeCloud({ signedIn: true });
    renderSettings(cloud, edited());
    await synced();
    fireEvent.click(screen.getByRole('radio', { name: 'kg' }));
    await waitFor(() => expect(cloud.data().settings.unit).toBe('kg'));
    expect(cloud.session.save).toHaveBeenCalledTimes(2);
  });

  it('picks up another device’s changes when the page regains focus', async () => {
    const cloud = fakeCloud({ signedIn: true });
    renderSettings(cloud, edited());
    await synced();
    cloud.saveElsewhere({ ...cloud.data(), settings: { ...cloud.data().settings, unit: 'kg' } });
    fireEvent.focus(window);
    await waitFor(() => expect(stored().settings.unit).toBe('kg'));
    expect((screen.getByRole('radio', { name: 'kg' }) as HTMLInputElement).checked).toBe(true);
  });

  it('keeps the newer change when both sides changed', async () => {
    const cloud = fakeCloud({ signedIn: true });
    renderSettings(cloud, edited(), 60_000);
    await synced();
    fireEvent.click(screen.getByRole('radio', { name: 'kg' }));
    // An older save from another device loses to the change made here.
    cloud.saveElsewhere(withAlex(), 1);
    fireEvent.focus(window);
    await waitFor(() => expect(cloud.data().settings.unit).toBe('kg'));
    expect(stored().people).toHaveLength(1);

    // A newer one wins.
    fireEvent.click(screen.getByRole('radio', { name: 'lb' }));
    cloud.saveElsewhere(withAlex(), Date.now() + 60_000);
    fireEvent.focus(window);
    await waitFor(() => expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']));
  });

  it('looks again when another device saved during the push', async () => {
    const cloud = fakeCloud({ signedIn: true });
    renderSettings(cloud, edited());
    await synced();
    cloud.session.save.mockImplementationOnce(async () => {
      cloud.saveElsewhere(withAlex(), 1);
      throw new CloudError('conflict', 'Conflict');
    });
    fireEvent.click(screen.getByRole('radio', { name: 'kg' }));
    await waitFor(() => expect(cloud.data().settings.unit).toBe('kg'));
    expect(cloud.session.save).toHaveBeenCalledTimes(3);
    expect(cloud.data().people).toHaveLength(1);
  });

  it('keeps this browser’s data and forgets the link on sign-out', async () => {
    const cloud = fakeCloud({ signedIn: true });
    renderSettings(cloud, edited());
    await synced();
    const before = stored();
    cloud.signOut();
    await waitFor(() => expect(card()?.textContent).toContain('Sign in with your Apple ID'));
    expect(stored()).toEqual(before);
    expect(readMeta(localStorage)).toEqual(EMPTY_META);
  });

  it('never replaces or overwrites a plan saved by a newer version', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.record = { json: JSON.stringify({ ...withAlex(), version: 4 }), savedAt: 1, tag: 'future' };
    renderSettings(cloud, edited());
    expect((await screen.findByRole('alert')).textContent).toContain('newer version of Mixing Bowl');
    expect(stored().people).toHaveLength(1);
    expect(cloud.session.save).not.toHaveBeenCalled();
  });

  it('starts over when the saved sync state belongs to a different plan', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.saveElsewhere(withAlex());
    const tag = cloud.record!.tag;
    // This browser last synced with someone else's shared plan, at the same tag.
    localStorage.setItem(SYNC_KEY, JSON.stringify({ tag, syncedHash: 'x', editedAt: 0, place: 'shared:u2' }));
    renderSettings(cloud, edited());
    await screen.findByText(/Your iCloud already has a Mixing Bowl plan/);
    expect(cloud.session.place).toHaveBeenCalled();
    expect(cloud.session.save).not.toHaveBeenCalled();
  });

  it('keeps an unsynced edit when another device only moved or shared the plan', async () => {
    const cloud = fakeCloud({ signedIn: true });
    const base = edited();
    // Last synced here under tag 'old'; this browser has changed the unit since.
    localStorage.setItem(SYNC_KEY, JSON.stringify({ tag: 'old', syncedHash: hashData(base), editedAt: 1000, place: 'own' }));
    const changed: AppData = { ...base, settings: { ...base.settings, unit: 'kg' } };
    // Later, another device moved the same plan into the zone: new tag, newer save time, same content.
    cloud.slots.own = { json: JSON.stringify(base), savedAt: 5000, tag: 'moved' };
    renderSettings(cloud, changed);
    await synced();
    expect(cloud.data().settings.unit).toBe('kg');
    expect(stored().settings.unit).toBe('kg');
  });

  it('finds the plan again after failing to at sign-in', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.session.place.mockRejectedValueOnce(new Error('Network down'));
    renderSettings(cloud, edited());
    expect((await screen.findByRole('alert')).textContent).toBe('Network down');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await synced();
    expect(cloud.data()).toEqual(stored());
  });

  it('shows errors and tries again', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.session.fetch.mockRejectedValueOnce(new Error('Network down'));
    renderSettings(cloud, edited());
    expect((await screen.findByRole('alert')).textContent).toBe('Network down');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await synced();
    expect(cloud.data()).toEqual(stored());
  });
});

const sharing = () => screen.getByRole('group', { name: 'Household sharing' });

describe('household sharing', () => {
  const clipboard = (writeText: ((text: string) => Promise<void>) | null) =>
    Object.defineProperty(navigator, 'clipboard', { value: writeText && { writeText }, configurable: true });
  const share = (fn: ((data: ShareData) => Promise<void>) | null) =>
    Object.defineProperty(navigator, 'share', { value: fn ?? undefined, configurable: true });
  afterEach(() => {
    clipboard(null);
    share(null);
  });

  it('shares your plan with a link you can copy', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const cloud = fakeCloud({ signedIn: true });
    renderSettings(cloud, edited());
    await synced();
    fireEvent.click(screen.getByRole('button', { name: 'Share plan' }));
    const link = (await screen.findByRole('textbox', { name: 'Invite link' })) as HTMLInputElement;
    expect(link.value).toBe(`${location.origin}${import.meta.env.BASE_URL}#/join/CODE1`);
    expect(link.readOnly).toBe(true);
    expect(sharing().textContent).toContain('Shared — anyone with the link can join.');
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link.value));
    expect(await screen.findByText('Copied')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share…' })).toBeNull();
  });

  it('offers the system share sheet where the browser has one', async () => {
    const shareSheet = vi.fn(async () => undefined);
    share(shareSheet);
    const cloud = fakeCloud({ signedIn: true });
    cloud.place = { kind: 'own', code: 'CODE1' };
    renderSettings(cloud, edited());
    await synced();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Share…' }));
    expect(shareSheet).toHaveBeenCalledWith({ title: 'Mixing Bowl', url: expect.stringMatching(/#\/join\/CODE1$/) });
  });

  it('only offers Share plan once the plan is synced', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, edited());
    await screen.findByText(/Your iCloud already has a Mixing Bowl plan/);
    expect((screen.getByRole('button', { name: 'Share plan' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('stops sharing after you confirm', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.place = { kind: 'own', code: 'CODE1' };
    renderSettings(cloud, edited());
    await synced();
    fireEvent.click(within(sharing()).getByRole('button', { name: 'Stop sharing' }));
    const confirm = screen.getByRole('group', { name: 'Everyone who joined loses access. Your plan stays as it is.' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Stop sharing' }));
    expect(await screen.findByRole('button', { name: 'Share plan' })).toBeTruthy();
    expect(cloud.session.stopSharing).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox', { name: 'Invite link' })).toBeNull();
  });

  it('shows what went wrong when sharing fails', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.session.share.mockRejectedValueOnce(new CloudError('other', 'iCloud is busy.'));
    renderSettings(cloud, edited());
    await synced();
    fireEvent.click(screen.getByRole('button', { name: 'Share plan' }));
    expect((await within(sharing()).findByRole('alert')).textContent).toBe('iCloud is busy.');
  });

  it('takes the household plan on a member’s other device, without asking', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.place = { kind: 'member', ownerId: 'u1', owner: 'Daniel' };
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, edited());
    await synced();
    expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']);
    expect(cloud.session.save).not.toHaveBeenCalled();
    expect(sharing().textContent).toContain('Using a shared plan');
    expect(screen.queryByRole('button', { name: 'Share plan' })).toBeNull();
  });

  it('leaves the shared plan after you confirm, and goes back to your own', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.slots.own = { json: JSON.stringify(edited()), savedAt: 1, tag: 'own-1' };
    cloud.place = { kind: 'member', ownerId: 'u1', owner: 'Daniel' };
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, fresh());
    await synced();
    fireEvent.click(within(sharing()).getByRole('button', { name: 'Leave' }));
    const confirm = screen.getByRole('group', { name: 'This browser keeps a copy. Your own iCloud plan is used again.' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Leave' }));
    // The household copy here differs from your own iCloud plan, so the usual question comes up.
    await screen.findByText(/Your iCloud already has a Mixing Bowl plan/);
    expect(cloud.session.leave).toHaveBeenCalledTimes(1);
    expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']);
  });

  it('never writes the household plan into your own when you leave during a push', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.slots.own = { json: JSON.stringify(edited()), savedAt: 1, tag: 'own-1' };
    cloud.place = { kind: 'member', ownerId: 'u1', owner: 'Daniel' };
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, fresh());
    await synced();
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const save = cloud.session.save.getMockImplementation()!;
    cloud.session.save.mockImplementationOnce(async (where, json, tag) => {
      await gate;
      return save(where, json, tag);
    });
    fireEvent.click(screen.getByRole('radio', { name: 'kg' }));
    await waitFor(() => expect(cloud.session.save).toHaveBeenCalledTimes(1));
    fireEvent.click(within(sharing()).getByRole('button', { name: 'Leave' }));
    const confirm = screen.getByRole('group', { name: 'This browser keeps a copy. Your own iCloud plan is used again.' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(cloud.session.leave).toHaveBeenCalled());
    release();
    await screen.findByText(/Your iCloud already has a Mixing Bowl plan/);
    expect(cloud.slots.own?.tag).toBe('own-1');
    expect(JSON.parse(cloud.slots.shared!.json).settings.unit).toBe('kg');
  });

  it('stops and says so when the shared plan stays out of reach', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.place = { kind: 'member', ownerId: 'u1', owner: 'Daniel' };
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, fresh());
    await synced();
    // iCloud still lists the shared plan but won't hand it over.
    cloud.session.fetch.mockRejectedValue(new CloudError('gone', 'This plan is no longer shared with you.'));
    fireEvent.focus(window);
    expect((await screen.findByRole('alert')).textContent).toBe('This plan is no longer shared with you.');
    const lookups = cloud.session.place.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(cloud.session.place.mock.calls.length).toBe(lookups);
  });

  it('says so when the owner stops sharing, keeps this browser’s copy and goes back to your own plan', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.place = { kind: 'member', ownerId: 'u1', owner: 'Daniel' };
    cloud.saveElsewhere(withAlex());
    renderSettings(cloud, fresh());
    await synced();
    cloud.sharedGone = true;
    fireEvent.focus(window);
    expect(await within(sharing()).findByText('This plan is no longer shared with you.')).toBeTruthy();
    await synced();
    expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']);
    // Your own iCloud had no plan, so this browser's copy becomes it.
    expect(JSON.parse(cloud.slots.own!.json).people).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Share plan' })).toBeTruthy();
  });
});

describe('joining from an invite link', () => {
  function renderJoin(cloud: ReturnType<typeof fakeCloud> | null, code: string, local = edited()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    history.replaceState(null, '', `#/join/${code}`);
    return render(<App cloud={cloud?.connect ?? null} syncDelay={0} />);
  }
  const household = (cloud: ReturnType<typeof fakeCloud>) => {
    cloud.slots.shared = { json: JSON.stringify(withAlex()), savedAt: 1, tag: 's1' };
  };

  it('asks you to sign in first', async () => {
    const cloud = fakeCloud();
    renderJoin(cloud, 'HOUSE');
    expect(await screen.findByText('Sign in with your Apple ID to join a shared Mixing Bowl plan.')).toBeTruthy();
    expect(document.getElementById('apple-sign-in-button')).toBeTruthy();
    expect(cloud.session.inspect).not.toHaveBeenCalled();
  });

  it('joins after you confirm, takes the shared plan without asking and opens Today', async () => {
    const cloud = fakeCloud({ signedIn: true });
    household(cloud);
    renderJoin(cloud, 'HOUSE');
    expect(await screen.findByRole('heading', { name: "Join Daniel's plan?" })).toBeTruthy();
    expect(screen.getByText('This replaces the plan in this browser.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(location.hash).toBe('#/today'));
    await waitFor(() => expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']));
    expect(cloud.session.join).toHaveBeenCalledWith('HOUSE');
    // The household's plan is taken as it is, never overwritten by this browser's.
    expect(cloud.slots.shared).toEqual({ json: JSON.stringify(withAlex()), savedAt: 1, tag: 's1' });
    expect(screen.queryByText(/Your iCloud already has a Mixing Bowl plan/)).toBeNull();
  });

  it('stays joined even when iCloud doesn’t list the shared plan yet', async () => {
    const cloud = fakeCloud({ signedIn: true });
    household(cloud);
    // Accepted, but the shared database doesn't show the zone yet: looking up places still says your own.
    cloud.session.join.mockImplementationOnce(async () => ({ owner: 'Daniel', ownerId: 'u1' }));
    renderJoin(cloud, 'HOUSE');
    fireEvent.click(await screen.findByRole('button', { name: 'Join' }));
    await waitFor(() => expect(location.hash).toBe('#/today'));
    await waitFor(() => expect(stored().people.map((p) => p.name)).toEqual(['Me', 'Alex']));
  });

  it('can be put off', async () => {
    const cloud = fakeCloud({ signedIn: true });
    renderJoin(cloud, 'HOUSE');
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(location.hash).toBe('#/today'));
    expect(cloud.session.join).not.toHaveBeenCalled();
  });

  it('says when the invite no longer works', async () => {
    renderJoin(fakeCloud({ signedIn: true }), 'DEAD');
    expect(await screen.findByText('This invite no longer works. Ask for a new link.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
  });

  it('recognises your own invite', async () => {
    renderJoin(fakeCloud({ signedIn: true }), 'MINE');
    expect(await screen.findByText("This is your own plan's invite link.")).toBeTruthy();
  });

  it('says when you already use a shared plan', async () => {
    const cloud = fakeCloud({ signedIn: true });
    cloud.place = { kind: 'member', ownerId: 'u1', owner: 'Daniel' };
    household(cloud);
    renderJoin(cloud, 'HOUSE');
    expect(await screen.findByText("You're already using a shared plan. Leave it in Settings to join a different one.")).toBeTruthy();
    expect(cloud.session.inspect).not.toHaveBeenCalled();
  });

  it('explains when this version has no iCloud sync', () => {
    renderJoin(null, 'HOUSE');
    expect(screen.getByText("iCloud sync isn't set up in this version.")).toBeTruthy();
  });

  it('marks no tab as current', async () => {
    renderJoin(fakeCloud(), 'HOUSE');
    await screen.findByText('Sign in with your Apple ID to join a shared Mixing Bowl plan.');
    const tabs = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(tabs.filter((tab) => tab.getAttribute('aria-current') === 'page')).toHaveLength(0);
  });
});
