import { useState } from 'preact/hooks';
import { joinLink } from '../router';
import type { CloudSync } from '../useCloudSync';

const STOP_CONFIRM = 'Everyone who joined loses access. Your plan stays as it is.';
const LEAVE_CONFIRM = 'This browser keeps a copy. Your own iCloud plan is used again.';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong with iCloud.');

/** Share your plan with an invite link, or leave the household plan you joined. */
export function HouseholdSharing({ sync }: { sync: CloudSync }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const { place } = sync;
  if (!place) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirming(false);
      setCopied(false);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const link = place.kind === 'own' && place.code ? joinLink(place.code) : null;
  const canCopy = typeof navigator.clipboard?.writeText === 'function';
  const canShare = typeof navigator.share === 'function';

  const confirm = (question: string, label: string, action: () => Promise<void>) => (
    <div class="confirm" role="group" aria-label={question}>
      <p>{question}</p>
      <div class="entry-actions">
        <button type="button" class="button-secondary danger" disabled={busy} onClick={() => void run(action)}>
          {label}
        </button>
        <button type="button" class="button-secondary" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div class="household" role="group" aria-label="Household sharing">
      {sync.notice === 'unshared' && <p class="notice">This plan is no longer shared with you.</p>}

      {place.kind === 'member' ? (
        <>
          <p>{place.owner ? `Using ${place.owner}'s shared plan` : 'Using a shared plan'}</p>
          {confirming ? (
            confirm(LEAVE_CONFIRM, 'Leave', sync.leave)
          ) : (
            <button type="button" class="button-secondary" onClick={() => setConfirming(true)}>
              Leave
            </button>
          )}
        </>
      ) : link ? (
        <>
          <p>Shared — anyone with the link can join.</p>
          <div class="field">
            <label for="invite-link">Invite link</label>
            <input
              id="invite-link"
              type="text"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <div class="entry-actions">
            {canCopy && (
              <button
                type="button"
                class="button-secondary"
                onClick={() =>
                  void navigator.clipboard.writeText(link).then(
                    () => setCopied(true),
                    () => setError("Couldn't copy. Select the link and copy it yourself."),
                  )
                }
              >
                Copy link
              </button>
            )}
            {canShare && (
              <button
                type="button"
                class="button-secondary"
                onClick={() => void navigator.share({ title: 'Mixing Bowl', url: link }).catch(() => undefined)}
              >
                Share…
              </button>
            )}
            {!confirming && (
              <button type="button" class="button-secondary" onClick={() => setConfirming(true)}>
                Stop sharing
              </button>
            )}
          </div>
          {copied && (
            <p class="meta" role="status">
              Copied
            </p>
          )}
          {confirming && confirm(STOP_CONFIRM, 'Stop sharing', sync.stopSharing)}
        </>
      ) : (
        <>
          <p class="meta">Share your plan with someone in your household. They sign in with their own Apple ID.</p>
          <button
            type="button"
            class="button-secondary"
            disabled={busy || sync.status !== 'synced'}
            onClick={() => void run(sync.share)}
          >
            Share plan
          </button>
        </>
      )}

      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
