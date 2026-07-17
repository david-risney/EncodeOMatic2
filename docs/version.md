# Version management

## How versioning works

The app version is stored in one place: `src/version.js`.

```js
export const APP_VERSION = '1.0.0';
```

The service worker in `sw.js` derives a cache name from the same version
string:

```js
const CACHE_NAME = 'encodeomatic2-v1.0.0';
```

When the service worker detects that its `CACHE_NAME` has changed (because the
`sw.js` file itself changed), it installs a new cache, pre-fetches every URL in
`PRECACHE_URLS`, and then deletes all caches that share the `encodeomatic2-v`
prefix but no longer match the current name. This is the mechanism that
propagates updates to installed PWA clients.

The app also performs an explicit update check. On load it fetches
`src/version.js?cache=off` — bypassing the service worker cache — and compares
the `APP_VERSION` value found in the network response against the version that
was bundled into the cached app shell. If they differ, an **Update** button
appears in the UI. Clicking it unregisters the old service worker and reloads
the page, which triggers a fresh install of the new cache.

## When to bump the version

Bump the version with **every change that is deployed**. Because the installed
PWA shell is served entirely from the service worker cache, a version bump is
the only reliable signal that clients should fetch fresh files. Without it:

- Returning visitors stay on the old cached shell.
- The update-check fetch returns the same version and no update button appears.
- Newly added or renamed files in `PRECACHE_URLS` are never fetched.

There is no separate release branch workflow; every merge to `main` is
deployed, so every PR should include a version bump.

## How to bump the version

Run the PowerShell script from the repository root:

```powershell
pwsh scripts/bump-version.ps1 <major.minor.patch>
```

For example:

```powershell
pwsh scripts/bump-version.ps1 1.2.0
```

The script updates exactly two files:

| File | What changes |
|------|--------------|
| `src/version.js` | `APP_VERSION` constant |
| `sw.js` | `CACHE_NAME` constant |

Both files must stay in sync. Always use the script rather than editing them
manually.

## Adding new runtime assets

When you add or rename a JavaScript module, stylesheet, image, or any other
file that the app needs at runtime, add its path to the `PRECACHE_URLS` array
in `sw.js`. If the path is missing, the service worker will not cache it on
install, and users who open the app while offline will hit a network error for
that resource.

After updating `PRECACHE_URLS`, bump the version so that existing clients
install a new cache that includes the new entry.
