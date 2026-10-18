# Mixing Bowl — Share the Plan with Your Household

**Date:** 2026-10-15
**Builds on:** `2026-10-12-icloud-sync-design.md`.
**Goal:** Two people, each signed in with their own Apple ID, edit one plan. The owner sends an invite link; the other person opens it, signs in and joins. No shared passwords, no server.

## 1. Decisions

| Topic | Decision |
|---|---|
| Mechanism | CloudKit sharing: the owner's plan record is shared from their private database with a `cloudkit.share` record; members read and write it through their shared database. |
| Invite link | The app's own link, `https://danielgollas.github.io/mixingbowl/#/join/<code>`, where `<code>` is the share's short GUID. Apple's `icloud.com/share/…` links target native apps and aren't used. |
| Who can join | Anyone with the link who signs in with an Apple ID (share `publicPermission: READ_WRITE`). The code is long and random; Stop sharing revokes it for everyone. |
| Where the plan lives | Every signed-in owner keeps the plan record in a custom zone `Household` of their private database, because CloudKit only shares records in custom zones. On the first sync with this version, a plan in the default zone is copied there (keeping its original save time); the old default-zone record is left untouched. |
| Owner: Share plan | Settings → iCloud sync → **Share plan** creates the share (or reuses the existing one) and shows the link with **Copy link** and, where the browser has it, **Share…** (the system share sheet). The card then says "Shared — anyone with the link can join." and offers **Stop sharing** with an inline confirm ("Everyone who joined loses access. Your plan stays as it is."). |
| Joining | `#/join/<code>`: a Join page. Signed out → Apple's sign-in button. Signed in → "Join {owner}'s plan?" (owner's name when iCloud provides it, else "Join this shared plan?") and "This replaces the plan in this browser." with **Join** / **Not now**. Join accepts the share, adopts the shared plan without asking again, and goes to Today. |
| Member devices | A signed-in user whose shared database holds a `Household` zone uses that shared plan on every device, without opening the link again. The first time a device switches to the shared plan it adopts it without asking, so a stale local plan can never overwrite the household's. |
| Member: Leave | The card says "Using a shared plan" (with the owner's name when known) and offers **Leave** with an inline confirm ("This browser keeps a copy. Your own iCloud plan is used again."). Leave removes the shared zone from the member's shared database, which leaves the share. |
| Back to your own plan | After Leave, or when the owner stops sharing (the shared zone is gone), the member's app goes back to their own private plan. That is a fresh sync, so the existing rules apply: untouched or equal data adopts, different data asks "Which one do you want to keep?". When sharing was stopped the card first says "This plan is no longer shared with you." |
| Sync rules | Unchanged. Sync metadata now records which plan it belongs to (`place`: `own`, or `shared:<owner record name>`); metadata for another place counts as never synced. |
| Dead link | Accept fails (share deleted or code wrong) → "This invite no longer works. Ask for a new link." on the Join page. |
| Owner joins own link | "This is your own plan's invite link." No accept. |
| Environment | The build switches to `production` once the owner deploys the schema in the CloudKit Console. |

## 2. Screens

- **Settings → iCloud sync** (signed in):
  - Owner, not shared: Share plan.
  - Owner, shared: the link (read-only text field), Copy link, Share…, Stop sharing.
  - Member: "Using a shared plan", Leave.
  - "This plan is no longer shared with you." notice when it applies.
- **Join page** `#/join/<code>`: as above. No tab is current. Sync off in this build → "iCloud sync isn't set up in this version."

## 3. Code

- `lib/sync.ts`: `CloudErrorCode` adds `'gone'` and `'own'`. `CloudSession` gains:
  - `place(): Promise<Place>` — `{ kind: 'own'; code: string | null }` (code of the owner's share, if any) or `{ kind: 'member'; ownerId: string; owner: string | null }` (owner's user record name and display name). Called after each sign-in; `fetch`/`save` use the place it found.
  - `share(): Promise<string>` — creates or returns the share code (owner only).
  - `stopSharing(): Promise<void>` (owner only).
  - `inspect(code): Promise<{ owner: string | null }>` — looks the invite up without accepting, for the Join prompt; same errors as `join`.
  - `join(code): Promise<{ owner: string | null }>` — accepts; the session is now a member. Throws `CloudError('gone')` for a dead link and `CloudError('own')` for the owner's own link.
  - `leave(): Promise<void>` (member only); the session is the owner of its own plan again.
  - `fetch` throws `CloudError('gone')` when a member's shared zone has disappeared.
  - `SyncMeta.place: string` (`'own'` or `shared:<ownerId>`); `readMeta` repairs a missing place to `'own'`.
- `lib/cloudkit.ts`: zone `Household`; zone creation; default-zone migration; share record create/fetch/delete; `acceptShares`; `fetchRecordInfos` for the owner's name; shared-database zone listing and deletion.
- `useCloudSync.ts`: `place` state, `share()`, `stopSharing()`, `join(code)`, `leave()`, `unshared` notice; a `gone` error switches back to the own plan and re-syncs.
- `router.ts`: `{ name: 'join'; code: string }` ↔ `#/join/<code>`.
- `views/Join.tsx`; `components/CloudSyncCard.tsx` gets the sharing section.

## 4. Testing

- Fake CloudKit (adapter): migration copies the default-zone plan into `Household` with its save time and leaves the original; share create returns the short GUID and reuses an existing share; stop sharing deletes it; accept maps zone and owner; dead link → `gone`; member fetch on a missing zone → `gone`; place detection for owner, shared owner and member.
- Hook through the app with a fake session: Share plan shows the link and Copy; Stop sharing confirms and returns to Share plan; Join page signed out shows sign-in; Join adopts the shared plan without asking and lands on Today; dead link message; own link message; member card and Leave → back to own plan; owner stopped sharing → notice, back to own plan, asks when the plans differ; metadata for another place counts as never synced.
- Router parses and builds `#/join/<code>`.
- Not testable here: a real two-Apple-ID join. The first live check is the owner sending the link.

## 5. Known limits

- A device still running the previous version keeps syncing the old default-zone record until it reloads; its changes in that window don't reach the shared plan.
- Anyone the link is forwarded to can join until sharing is stopped.
