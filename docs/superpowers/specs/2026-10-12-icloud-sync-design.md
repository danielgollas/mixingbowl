# Mixing Bowl — Sync with iCloud

**Date:** 2026-10-12
**Builds on:** `2026-10-10-household-design.md`.
**Goal:** Sign in with an Apple ID and keep the plan in that account's private iCloud database, so it follows you across devices and browsers. The site stays static on GitHub Pages: no server.

## 1. Decisions

| Topic | Decision |
|---|---|
| Service | CloudKit JS (`https://cdn.apple-cloudkit.com/ck/2/cloudkit.js`), loaded only when sync is configured. The private database of the signed-in user. |
| Configuration | Build-time env: `VITE_CLOUDKIT_CONTAINER`, `VITE_CLOUDKIT_API_TOKEN`, `VITE_CLOUDKIT_ENVIRONMENT` (`development` or `production`, default `production`). The web API token is public by design and limited to allowed origins. Without a container and token, sync is off and nothing about it is shown. |
| Record | One record per user: type `AppData`, name `mixingbowl`, one String field `plan` holding the whole `AppData` as JSON. The server's modified time is the remote save time. |
| Local copy | `localStorage` stays the source the app reads and writes. Sync runs beside it; signed out or offline, the app works as before. |
| Sync metadata | `mixingbowl:sync` in the same storage: `{ tag, syncedHash, editedAt }` — the record change tag and data hash at the last sync, and when this browser last changed the data. |
| When to sync | On sign-in, when the page regains focus, 1.5 s after the last change, and right away when the page is hidden. One sync at a time; a request during a sync runs another afterwards. |
| Reconcile | Fetch the record, then: no record → push. Never synced in this browser → adopt if the data is the same or this browser is untouched (default data), otherwise ask. Remote unchanged → push if local changed. Local unchanged → adopt. Both changed → the newer one wins (remote modified time vs. local `editedAt`). |
| Conflicts on push | Pushes send the change tag; a conflict re-runs the sync (up to 3 tries). |
| Ask | "Your iCloud already has a plan." — Use iCloud's plan / Use this browser's plan. Edits wait until answered. |
| Newer data | A record this version can't read (unknown `version`) is never adopted or overwritten; Settings says to reload. |
| Sign out | Apple's sign-out button. Keeps this browser's data, forgets the sync metadata. |

## 2. Screens

- **Settings → iCloud sync** card (only when configured):
  - Connecting: "Connecting to iCloud…".
  - Signed out: a sentence and Apple's Sign in with Apple ID button.
  - Signed in: "Synced with iCloud" with the last sync time, or "Syncing…"; Apple's sign-out button.
  - Ask: the question and two buttons.
  - Error: the message and Try again.
- About text says data stays in this browser unless iCloud sync is on.

## 3. Code

- `lib/sync.ts`: types (`RemoteRecord`, `CloudSession`, `CloudConnector`, `CloudError`), `stableStringify`, `hashData`, `isUntouched`, `readMeta`/`writeMeta`, `reconcile`.
- `lib/cloudkit.ts`: `cloudConfig(env)`, `cloudKitConnector(config)` (loads the script once, configures the container with Apple's buttons, maps CloudKit responses and error codes).
- `useCloudSync.ts`: the hook; `AppStateProvider` exposes it as `sync`.
- `storage.ts`: `parseData(json, today)` returns `null` for anything unreadable; `load` falls back to defaults.

## 4. Setup (owner)

1. developer.apple.com → Identifiers → iCloud Containers → new container, e.g. `iCloud.io.github.danielgollas.mixingbowl`.
2. CloudKit Console → the container → Schema (Development): record type `AppData` with field `plan` (String). Deploy schema changes to Production.
3. CloudKit Console → API Access → API Tokens → new token: Sign In Callback "Post Message", Allowed Origins `https://danielgollas.github.io` (and `http://localhost:5173` for development).
4. Repository variables `CLOUDKIT_CONTAINER`, `CLOUDKIT_API_TOKEN`, `CLOUDKIT_ENVIRONMENT`; the deploy workflow passes them to the build. Locally, `.env.local`.

## 5. Testing

- Reconcile table; hashing ignores key order; untouched detection; metadata repair.
- CloudKit adapter against a fake `window.CloudKit`: config parsing, record mapping, NOT_FOUND → no record, CONFLICT/EXISTS → conflict error, auth status.
- Hook through the app with a fake session: hidden when off; signed out shows the button; first sign-in pushes; untouched browser adopts; different data asks and both answers work; edits push; remote changes adopt on focus; both changed → newer wins; conflict retries; sign-out keeps data; newer data errors.
