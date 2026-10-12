import { useEffect } from 'preact/hooks';
import { SIGN_IN_BUTTON_ID, SIGN_OUT_BUTTON_ID } from '../lib/cloudkit';
import { useAppState } from '../state';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function CloudSyncCard() {
  const { sync } = useAppState();
  const { status, signedIn, lastSynced, error } = sync;

  // Apple draws its buttons into empty elements by id; redraw whenever the element on the page changes.
  useEffect(() => {
    if (status !== 'connecting') sync.drawButtons();
  }, [signedIn, status === 'connecting']);

  if (status === 'off') return null;

  return (
    <section class="card cloud-sync" aria-labelledby="cloud-title">
      <h2 id="cloud-title">iCloud sync</h2>

      {status === 'connecting' && <p class="meta">Connecting to iCloud…</p>}

      {status === 'signed-out' && (
        <p class="meta">
          Sign in with your Apple ID to keep your plan in your own iCloud and use it on your other devices.
        </p>
      )}

      {(status === 'syncing' || status === 'synced') && (
        <p role="status">
          {status === 'syncing' ? 'Syncing…' : 'Synced with iCloud'}
          {status === 'synced' && lastSynced !== null && (
            <span class="meta">{` · ${timeFormat.format(lastSynced)}`}</span>
          )}
        </p>
      )}

      {status === 'ask' && (
        <div class="confirm" role="group" aria-labelledby="cloud-ask">
          <p id="cloud-ask">
            Your iCloud already has a Mixing Bowl plan, and it's different from the one in this browser. Which one do
            you want to keep? The other one is replaced.
          </p>
          <div class="entry-actions">
            <button type="button" class="button-secondary" onClick={sync.keepCloud}>
              Use iCloud's plan
            </button>
            <button type="button" class="button-secondary" onClick={sync.keepLocal}>
              Use this browser's plan
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <>
          <p class="error" role="alert">
            {error ?? "Couldn't reach iCloud."}
          </p>
          <p class="meta">Your changes are saved in this browser and sync once iCloud is back.</p>
          <button type="button" class="button-secondary" onClick={sync.syncNow}>
            Try again
          </button>
        </>
      )}

      {status !== 'connecting' &&
        (signedIn ? (
          <div key="out" id={SIGN_OUT_BUTTON_ID} class="apple-button" />
        ) : (
          status !== 'error' && <div key="in" id={SIGN_IN_BUTTON_ID} class="apple-button" />
        ))}
    </section>
  );
}
