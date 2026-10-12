import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { today } from './lib/clock';
import { STORAGE_KEY, defaultData, newPerson, type AppData } from './lib/storage';
import { CloudError, EMPTY_META, readMeta, type CloudSession, type RemoteRecord } from './lib/sync';

/** A pretend iCloud account. */
function fakeCloud({ signedIn = false } = {}) {
  let n = 0;
  let onSignIn: (() => void) | null = null;
  let onSignOut: (() => void) | null = null;
  const cloud = {
    signedIn,
    record: null as RemoteRecord | null,
    session: {
      setUpAuth: vi.fn(async (): Promise<boolean> => cloud.signedIn),
      whenSignedIn: () => new Promise<void>((resolve) => (onSignIn = resolve)),
      whenSignedOut: () => new Promise<void>((resolve) => (onSignOut = resolve)),
      fetch: vi.fn(async (): Promise<RemoteRecord | null> => cloud.record),
      save: vi.fn(async (json: string, tag: string | null): Promise<RemoteRecord> => {
        if ((cloud.record?.tag ?? null) !== tag) throw new CloudError('conflict', 'Conflict');
        cloud.record = { json, savedAt: Date.now(), tag: `t${++n}` };
        return cloud.record;
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
