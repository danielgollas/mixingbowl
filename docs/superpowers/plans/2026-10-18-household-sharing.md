# Household Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner shares their iCloud plan with an invite link; another Apple ID joins and both edit one plan.

**Architecture:** `CloudSession` learns where the plan lives (`Place`: own private zone, or a shared zone owned by someone else) and gains share / inspect / join / leave. `useCloudSync` keys its metadata by place and switches place on join, leave or when a share disappears. The CloudKit adapter does zones, migration and share records; views add the sharing section and a Join page.

**Tech Stack:** Vite 8, Preact 10, TypeScript 7, Vitest 5 + @testing-library/preact (jsdom), CloudKit JS 2.

**Spec:** `docs/superpowers/specs/2026-10-15-household-sharing-design.md`

## Global Constraints

- Zone name `Household`; record type `AppData`, record name `mixingbowl`, field `plan` (unchanged).
- Invite link: `${location.origin}${import.meta.env.BASE_URL}#/join/<code>`; `<code>` is the share's short GUID.
- Share record: `recordType: 'cloudkit.share'`, `publicPermission: 'READ_WRITE'`.
- `SyncMeta.place`: `'own'` or `shared:<ownerId>`; missing → `'own'`. Metadata for another place counts as never synced.
- First switch of a device into a member place adopts the shared plan without asking.
- The old default-zone record is never deleted or changed.
- Copy is user-facing; use the exact strings from the spec's Decisions table.
- Node via `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`; full check is `npm test && npm run build`.

## Review Focus

- A member's second device (never opened the link) whose local plan differs → adopts the shared plan, never asks, never pushes its stale plan. Test in Task 3.
- Owner's first sync after this update with an unsynced local edit → migration keeps the original save time, so newer-edit-wins still picks correctly. Test in Task 2.
- Share plan pressed while sync is asking "which plan?" or in error → button disabled; no share of an unsynced plan. Test in Task 3.
- Owner stops sharing while a member is open → member sees the notice, keeps local data, returns to own plan (asks only if their own plan differs). Test in Task 3.
- Browser without `navigator.clipboard` or `navigator.share` → those buttons are hidden; the link field is still selectable. Test in Task 3.

---

### Task 1: Places in sync metadata and the session contract

**Files:** Modify `src/lib/sync.ts`, `src/useCloudSync.ts`, `src/lib/sync.test.ts`, `src/cloudSync.test.tsx` (fake session), `src/lib/cloudkit.ts` (stub methods so it still type-checks).

**Produces:**

```ts
export type CloudErrorCode = 'conflict' | 'auth' | 'gone' | 'own' | 'other';
export type Place = { kind: 'own'; code: string | null } | { kind: 'member'; ownerId: string; owner: string | null };
export const placeId = (place: Place): string => (place.kind === 'own' ? 'own' : `shared:${place.ownerId}`);
export interface SyncMeta { tag: string | null; syncedHash: string | null; editedAt: number; place: string }
export const EMPTY_META: SyncMeta = { tag: null, syncedHash: null, editedAt: 0, place: 'own' };
export interface CloudSession {
  // existing: setUpAuth, whenSignedIn, whenSignedOut, fetch, save
  place(): Promise<Place>;
  share(): Promise<string>;
  stopSharing(): Promise<void>;
  inspect(code: string): Promise<{ owner: string | null }>;
  join(code: string): Promise<{ owner: string | null }>;
  leave(): Promise<void>;
}
```

`useCloudSync` gains `place: Place | null` on `CloudSync`; after each sign-in it awaits `s.place()` before the first sync. `sync()` reads metadata through `metaFor(place)`: `readMeta(storage)` if its `place` equals `placeId(place)`, else `{ ...EMPTY_META, place: placeId(place) }`. Every `writeMeta` carries `place`. When a member place has never synced here (`meta.tag === null`), the plan is forced to `'adopt'` (when a remote exists).

- [ ] Tests in `sync.test.ts`: `readMeta` repairs a missing or non-string `place` to `'own'` and keeps `'shared:u2'`; `placeId` for both kinds.
- [ ] Fake session in `cloudSync.test.tsx` gains `place: vi.fn(async () => cloud.place)` with `cloud.place: Place = { kind: 'own', code: null }`, and the other new methods as `vi.fn` rejecting `new Error('unused')` until Task 3 fills them in.
- [ ] App test: metadata saved with `place: 'shared:u2'` while the session says `own` → the first sync treats it as never synced (different data asks "Which one do you want to keep?").
- [ ] Run, watch fail, implement (`cloudkit.ts` methods throw `new CloudError('other', 'Not available yet.')` for now), run `npm test && npm run build`.
- [ ] Commit "Key sync metadata by where the plan lives".

### Task 2: CloudKit adapter — zone, migration, sharing, joining

**Files:** Modify `src/lib/cloudkit.ts`, `src/lib/cloudkit.test.ts`.

**Consumes:** Task 1 types.

**CloudKit calls (CloudKit JS 2; verified present in `cloudkit.js`):**

- Private: `db.saveRecordZones([{ zoneName: 'Household' }])`; `db.fetchRecords([name], { zoneID })`; `db.saveRecords([record], { zoneID })`; `db.deleteRecords([{ recordName }], { zoneID })`.
- Shared: `container.sharedCloudDatabase.fetchAllRecordZones()` → `{ zones: [{ zoneID: { zoneName, ownerRecordName } }] }`; `fetchRecords`/`saveRecords` with that `zoneID`; `deleteRecordZones([zoneID])` to leave.
- `container.fetchRecordInfos([code])` → `results[0]` with `zoneID.ownerRecordName` and `ownerIdentity?.nameComponents?.givenName`; `container.acceptShares([code])` → `results[0]` with `zoneID`.
- `setUpAuth()` resolves the user identity; keep `userRecordName` as "me".
- A root record that is shared has `share: { recordName }`; the share record has `shortGUID`.

**Behaviour:**

- `place()`: shared zones contain `Household` → `{ kind: 'member', ownerId: zoneID.ownerRecordName, owner: null }` and remember that zone. Otherwise own: fetch the root in `Household`; if it has `share`, fetch the share record and use its `shortGUID` as `code`.
- Own `fetch()`: root in `Household`; on `ZONE_NOT_FOUND`/`NOT_FOUND` fall back to the default zone record; when that exists, create the zone and save its `plan` there with no tag, and return `{ json, savedAt: <default record's modified time>, tag: <new tag> }`.
- Own `save()`: into `Household` (create the zone first when the save fails with `ZONE_NOT_FOUND`, then retry once).
- `share()`: returns the existing share's `shortGUID`, else saves `{ recordType: 'cloudkit.share', forRecord: { recordName, recordChangeTag }, publicPermission: 'READ_WRITE', fields: { 'cloudkit.title': { value: 'Mixing Bowl plan' } } }` in `Household` and returns its `shortGUID`.
- `stopSharing()`: deletes the share record.
- `inspect(code)`/`join(code)`: `NOT_FOUND`, a missing result or a result error → `CloudError('gone', 'This invite no longer works. Ask for a new link.')`; owner equal to me → `CloudError('own', "This is your own plan's invite link.")`. `join` then accepts and becomes a member of that zone.
- Member `fetch()`: `ZONE_NOT_FOUND`, `NOT_FOUND` or `ACCESS_DENIED` → `CloudError('gone', 'This plan is no longer shared with you.')`.
- `leave()`: deletes the shared zone, then the session is own again.

- [ ] Tests with the fake `window.CloudKit` (extend `fakeCloudKit` with a zone-aware private db, a shared db, `fetchRecordInfos`, `acceptShares`): migration copies the plan with the original save time and leaves the default record unchanged; second fetch reads `Household` directly; save creates a missing zone; share creates then reuses; stop deletes; `place()` own / shared owner / member; inspect returns the owner's name; dead code → `gone`; own code → `own`; join switches fetch to the shared db; member fetch on a missing zone → `gone`; leave deletes the zone and fetch goes back to private.
- [ ] Run, watch fail, implement, run `npm test && npm run build`.
- [ ] Commit "Keep the plan in a Household zone and share it through CloudKit".

### Task 3: Sharing in the sync hook and Settings card

**Files:** Modify `src/useCloudSync.ts`, `src/components/CloudSyncCard.tsx`, `src/router.ts` (`joinLink`), `src/styles.css`, `src/cloudSync.test.tsx`.

**Consumes:** Task 1 contract.

**Produces:** on `CloudSync`: `notice: 'unshared' | null`; `share(): Promise<void>`; `stopSharing(): Promise<void>`; `join(code: string): Promise<void>`; `inspect(code: string): Promise<{ owner: string | null }>`; `leave(): Promise<void>`. `router.ts`: `joinLink(code: string, base = location.origin + import.meta.env.BASE_URL): string`.

- `join`: `s.join(code)`, set member place, clear notice, run a sync that adopts.
- `leave`: `s.leave()`, set own place (`await s.place()`), sync.
- A `gone` error during a member sync: set notice `'unshared'`, `place = await s.place()`, sync again (own rules: equal/untouched adopt, different asks).
- Card, signed in and place known: owner without code → Share plan (disabled unless status is `synced`); owner with code → "Shared — anyone with the link can join.", read-only link field (labelled "Invite link"), Copy link (only with `navigator.clipboard`, shows "Copied"), Share… (only with `navigator.share`), Stop sharing → inline confirm; member → "Using a shared plan" / "Using {owner}'s shared plan", Leave → inline confirm; notice paragraph when `notice === 'unshared'`. Errors from these actions show under the section (`role="alert"`).

- [ ] App tests (fake session methods now implemented in the fake): Share plan shows the link `…#/join/CODE`, Copy writes it to the clipboard; Share plan disabled while asking; Stop sharing confirm → back to Share plan; no clipboard/share → buttons hidden, field present; member card and Leave confirm → own place, asks when plans differ; member's other device with a different local plan adopts the shared plan without asking and pushes nothing; owner stopped sharing → notice, local data kept, back to own plan.
- [ ] Router test for `joinLink`.
- [ ] Run, watch fail, implement, run `npm test && npm run build`.
- [ ] Commit "Share plan, Stop sharing and Leave in Settings".

### Task 4: Join page

**Files:** Modify `src/router.ts`, `src/router.test.ts`, `src/app.tsx`, `src/components/TabBar.tsx`. Create `src/views/Join.tsx`. Tests in `src/cloudSync.test.tsx`.

**Consumes:** Task 3 `inspect`, `join`; `SIGN_IN_BUTTON_ID`.

- Route `{ name: 'join'; code: string }` ↔ `#/join/<code>` (decoded like bowl ids). TabBar: no tab current on `join`.
- Join page states: sync off → "iCloud sync isn't set up in this version."; connecting → "Connecting to iCloud…"; signed out → sentence + Apple sign-in button (calls `sync.drawButtons()` like the card); signed in → `inspect(code)` once: loading, then "Join {owner}'s plan?" / "Join this shared plan?" with "This replaces the plan in this browser." and Join / Not now; `gone` and `own` show their messages and a link to Today. Already a member of this owner → go straight to Today.
- Join → `await sync.join(code)` then `location.hash = '#/today'`. Not now → `#/today`.

- [ ] Tests: router parse/build; signed out shows sign-in; signed in shows owner name and Join adopts the shared plan and lands on Today without the "which plan?" question; dead link message; own link message; sync off message; no tab current.
- [ ] Run, watch fail, implement, run `npm test && npm run build`.
- [ ] Commit "Join a shared plan from an invite link".

### Task 5: Docs and deploy

- [ ] README: Settings line mentions sharing; iCloud setup section adds "Deploy the schema to Production, then set the repository variable `CLOUDKIT_ENVIRONMENT` to `production`" and how sharing works (invite link, Stop sharing, Leave).
- [ ] Full `npm test && npm run build`; check Settings and the Join page at 375 px in the browser (sync on via `.env.local` if present, else the off state); push; confirm the deploy.
