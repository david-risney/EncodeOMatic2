# Version management

## How versioning works

The app's identity is a short Git commit SHA rather than a hand-maintained
semver string.  The SHA is stored in `src/version.js`:

```js
export const APP_COMMIT = 'dev';
```

The placeholder `'dev'` is what lives in source control.  When the deploy
workflow runs it replaces both occurrences of `'dev'` — in `src/version.js`
and in `sw.js` — with the real short SHA before uploading the Pages artifact:

```sh
COMMIT=$(git rev-parse --short HEAD)
sed -i "s/'dev'/'${COMMIT}'/g" src/version.js sw.js
```

The service worker in `sw.js` derives its cache name from the same value:

```js
const CACHE_NAME = 'encodeomatic2-dev';
```

When the service worker detects that its `CACHE_NAME` has changed (because the
deployed `sw.js` now contains a different SHA), it installs a new cache,
pre-fetches every URL in `PRECACHE_URLS`, and then deletes all caches that
share the `encodeomatic2-` prefix but no longer match the current name.  This
is the mechanism that propagates updates to installed PWA clients.

The app also performs an explicit update check.  On load it fetches
`src/version.js?cache=off` — bypassing the service worker cache — and compares
the `APP_COMMIT` value found in the network response against the value that was
baked into the cached app shell at deploy time.  If they differ, an **Update**
button appears in the UI.

## No manual version bumps needed

Because the commit SHA is injected automatically at deploy time, you never need
to edit `src/version.js` or `sw.js` by hand.  Every merge to `main` triggers a
fresh deploy with the correct SHA.

## Adding new runtime assets

When you add or rename a JavaScript module, stylesheet, image, or any other
file that the app needs at runtime, add its path to the `PRECACHE_URLS` array
in `sw.js`.  If the path is missing, the service worker will not cache it on
install, and users who open the app while offline will hit a network error for
that resource.
