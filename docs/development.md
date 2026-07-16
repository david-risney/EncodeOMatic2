# Development and testing

## Local setup

Node 22 matches CI. Install locked development dependencies with:

```sh
npm ci
```

There is no build command. Serve the repository root so browser ES modules and
module workers have HTTP origins:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Opening `index.html` directly with a
`file:` URL is not equivalent because browser module and worker restrictions
apply.

## Validation

Run both required checks before completing a change:

```sh
npm run check
npm test
```

`npm run check` runs `node --check` over JavaScript in `src/` and `tests/`.
`npm test` runs Vitest once. `npm run test:watch` is available during
development.

Documentation-only changes have no rendered application result, so screenshots
are not applicable. For a renderable application change, capture at least one
screenshot and include it in progress and review material.

## Test organization

Vitest uses jsdom through `vitest.config.js`. `tests/setup.js` installs
fake-indexeddb, supplies missing dialog/DOM behavior, restores mocks, clears
the document, and resets the URL after each test.

- `pipe.test.js`: base pipe and `StringPipe`.
- `encoding-pipes.test.js`: source and encoding transformations.
- `parsing-pipes.test.js`: parsing and dynamic ports.
- `graph-registry.test.js`: graph mutation, traversal, execution,
  serialization, and registry.
- `worker-pool.test.js` and `pipe-worker.test.js`: both sides of worker
  dispatch.
- `ui.test.js`: Web Components and graph interactions.
- `app.test.js`: application-level user flow.
- `state.test.js`: URL and IndexedDB persistence.
- `input-appropriateness.test.js` and `guess.test.js`: ranking and chain
  search.
- `session-name.test.js`: generated names.

Prefer the narrow related test file while iterating, then run the full required
commands.

## Automation

`.github/workflows/ci.yml` runs `npm ci`, syntax checking, and tests on pull
requests and pushes to `main`.

`.github/workflows/deploy.yml` uploads the repository as a static Pages
artifact and deploys only on pushes to `main`. Because the whole repository is
published without a build step, production paths and file casing must work
exactly as committed.
