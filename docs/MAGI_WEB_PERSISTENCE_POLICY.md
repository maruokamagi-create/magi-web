# MAGI WEB PERSISTENCE POLICY
Version 1.0 — 2026-08-26

## Purpose
Prevent routine MAGI Web updates from unexpectedly losing Google Drive settings, remembered account selection, deliberation history, or other browser-side state.

## Canonical production URL
Always use:

`https://magi-web.vercel.app`

Do not use a deployment-specific `magi-xxxxx.vercel.app` URL as the normal entry point. Browser storage is origin-specific, so a deployment URL can appear to have no saved settings even when the production URL still has them.

## Current storage audit
The current FREE CORE stores the following in `localStorage` on the browser/device:

- `magiGoogleClientIdV7` — Google OAuth Client ID
- `magiDriveRootV7` — Drive root folder ID
- `magiDriveAccountHintV92` — remembered Google account email used as `login_hint`
- `magiHistoryV7` — recent MAGI deliberation history
- `magiCaseCounterV7` — local case counter

These values are tied to the exact web origin and browser profile.

The following are **not persisted** and live only in the current page session/memory:

- `driveToken` — Google Drive OAuth access token
- `driveIndex` — current Drive file listing
- `dataRecords` — imported/indexed Drive and local data
- `importedDriveFiles` — current import tracking set

Therefore, after reload/redeploy, Drive may require token reacquisition even though the account hint and root/client settings remain saved.

## Google Drive authentication behavior
The app requests `drive.readonly` access and does not persist the access token to localStorage. It remembers only the account email as `magiDriveAccountHintV92`, then supplies that email as `login_hint` on later connections.

A reconnect can be required when:
- the in-memory token disappears because the page reloads,
- Google expires or rejects the token,
- the user opens MAGI under a different deployment/domain origin,
- browser/site storage is cleared,
- the app changes localStorage key names without migration.

## Mandatory update rules
1. Never rename or delete the existing persistence keys without an explicit migration path.
2. Never call `localStorage.clear()` in MAGI code.
3. Never remove `magiDriveAccountHintV92`, `magiGoogleClientIdV7`, or `magiDriveRootV7` during normal updates.
4. Keep the production entry URL fixed at `magi-web.vercel.app`.
5. Test changes on `magi-engine-v1-development` first.
6. Do not promote or redeploy an older deployment snapshot as the normal update method. Production updates should originate from the intended current Git commit.
7. Before production promotion, verify that persistence key names are unchanged or migrated.
8. After production deployment, verify on `magi-web.vercel.app`:
   - OAuth Client ID remains present,
   - Root Folder ID remains present,
   - remembered account state remains present when expected,
   - Google Drive reconnect works,
   - Drive index rebuild succeeds,
   - existing local history is still readable.

## Migration rule
If a key name must change, read both old and new keys for at least one release and copy the old value into the new key. Do not silently abandon the old key.

Example:

```js
const oldValue = localStorage.getItem('oldKey');
if (!localStorage.getItem('newKey') && oldValue) {
  localStorage.setItem('newKey', oldValue);
}
```

## Persistence classification
### Must survive routine updates
- OAuth Client ID
- Drive root folder ID
- remembered account hint
- deliberation history
- case counter

### May be rebuilt after reload
- OAuth access token
- Drive file index
- imported row index
- transient UI state

## Production release gate
A release must not be considered complete until persistence checks pass on the canonical production URL.

If any saved setting unexpectedly disappears, stop the rollout and investigate before continuing feature work.
