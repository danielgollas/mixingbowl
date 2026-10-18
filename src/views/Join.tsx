import { useEffect, useState } from 'preact/hooks';
import { SIGN_IN_BUTTON_ID } from '../lib/cloudkit';
import { CloudError } from '../lib/sync';
import { hrefFor } from '../router';
import { useAppState } from '../state';

type Invite = { state: 'loading' } | { state: 'ready'; owner: string | null } | { state: 'failed'; message: string };

const TODAY = hrefFor({ name: 'today' });

/** Opened from an invite link: sign in, then join the household's shared plan. */
export function Join({ code }: { code: string }) {
  const { sync } = useAppState();
  const { status, signedIn, place } = sync;
  const [invite, setInvite] = useState<Invite>({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookUp = signedIn && place?.kind === 'own';

  // Apple draws its sign-in button into the empty element by id.
  useEffect(() => {
    if (status !== 'connecting' && status !== 'off' && !signedIn) sync.drawButtons();
  }, [signedIn, status === 'connecting']);

  useEffect(() => {
    if (!lookUp) return;
    let live = true;
    setInvite({ state: 'loading' });
    sync.inspect(code).then(
      ({ owner }) => live && setInvite({ state: 'ready', owner }),
      (e: unknown) =>
        live &&
        setInvite({
          state: 'failed',
          message: e instanceof CloudError || e instanceof Error ? e.message : "Couldn't look up this invite.",
        }),
    );
    return () => {
      live = false;
    };
  }, [lookUp, code]);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await sync.join(code);
      location.hash = TODAY;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join this plan.");
      setBusy(false);
    }
  };

  const todayLink = (
    <a class="button-secondary" href={TODAY}>
      Go to Today
    </a>
  );

  const body = () => {
    if (status === 'off') return <p>iCloud sync isn't set up in this version.</p>;
    if (status === 'connecting' || (signedIn && !place)) return <p class="meta">Connecting to iCloud…</p>;
    if (!signedIn)
      return (
        <>
          {status === 'error' && (
            <p class="error" role="alert">
              {sync.error ?? "Couldn't reach iCloud."}
            </p>
          )}
          <p>Sign in with your Apple ID to join a shared Mixing Bowl plan.</p>
          {status === 'error' ? (
            <button type="button" class="button-secondary" onClick={sync.syncNow}>
              Try again
            </button>
          ) : (
            <div id={SIGN_IN_BUTTON_ID} class="apple-button" />
          )}
        </>
      );
    if (place?.kind === 'member')
      return (
        <>
          <p>You're already using a shared plan. Leave it in Settings to join a different one.</p>
          {todayLink}
        </>
      );
    if (invite.state === 'loading') return <p class="meta">Looking up the invite…</p>;
    if (invite.state === 'failed')
      return (
        <>
          <p>{invite.message}</p>
          {todayLink}
        </>
      );
    return (
      <div class="confirm" role="group" aria-labelledby="join-question">
        <h2 id="join-question">{invite.owner ? `Join ${invite.owner}'s plan?` : 'Join this shared plan?'}</h2>
        <p>This replaces the plan in this browser.</p>
        <div class="entry-actions">
          <button type="button" class="button-secondary" disabled={busy} onClick={() => void join()}>
            Join
          </button>
          <button type="button" class="button-secondary" onClick={() => (location.hash = TODAY)}>
            Not now
          </button>
        </div>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <header class="page-header">
        <h1>Join a shared plan</h1>
      </header>
      <section class="card join">{body()}</section>
    </>
  );
}
