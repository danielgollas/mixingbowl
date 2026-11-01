import { hrefFor } from '../router';
import { useAppState } from '../state';

/** One line about iCloud on every screen, only when there's something to say. Settings has the full card. */
export function SyncNote() {
  const { status, updated } = useAppState().sync;

  if (status === 'error' || status === 'ask')
    return (
      <p class="sync-note problem" role="status">
        <a href={hrefFor({ name: 'settings' })}>Not synced</a>
      </p>
    );
  if (updated)
    return (
      <p class="sync-note" role="status">
        Updated from iCloud
      </p>
    );
  if (status === 'syncing')
    return (
      <p class="sync-note" role="status">
        Syncing…
      </p>
    );
  return null;
}
