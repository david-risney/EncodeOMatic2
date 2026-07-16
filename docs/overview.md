# Repository overview

EncodeOMatic2 is a browser-only visual tool for building encoding, decoding,
and parsing pipelines. A user connects pipes in a directed graph, inspects
intermediate bytes as text or hex, shares the graph in a URL, or saves it as a
named local session.

## Technology choices

- Modern JavaScript using native ES modules.
- Vanilla HTML and CSS; there is no UI framework or build step.
- Web Components for `<graph-editor>` and `<data-viewer>`.
- Web Workers for off-main-thread pipe processing.
- `Uint8Array`, `TextEncoder`, and `TextDecoder` for data handling.
- IndexedDB for local sessions and base64url JSON for shared URL state.
- A web app manifest and service worker for installation and offline use.
- Vitest with jsdom and fake-indexeddb for tests.
- GitHub Actions for Node 22 CI and static GitHub Pages deployment.

Production has no runtime package dependencies. The packages in
`package.json` support testing only.

## Entry points

- `index.html` defines the application shell, toolbar, panels, and dialogs. It
  loads `src/app.js` with `type="module"`.
- `src/app.js` creates the graph and worker pool, registers UI handlers, loads
  state, and coordinates processing and rendering.
- `src/worker/pipe-worker.js` is the module worker entry point.
- `styles/main.css` contains shared tokens and shell styling; focused
  stylesheets cover controls, the graph, data views, dialogs, and feedback.
- `sw.js` precaches the application shell and `manifest.json` describes the
  installable app.

## Directory layout

```text
.
├── index.html
├── manifest.json
├── sw.js
├── src/
│   ├── app.js                 Application composition and UI orchestration
│   ├── guess.js               Decoding-chain search
│   ├── session-name.js        Random default session names
│   ├── state.js               URL and IndexedDB persistence
│   ├── pipes/
│   │   ├── pipe.js            Pipe, config, port, and error models
│   │   ├── string-pipe.js     Text-oriented pipe base class
│   │   ├── graph.js           DAG and execution orchestration
│   │   ├── registry.js        Main-thread built-in registry
│   │   └── builtin/           Input, encoding, and parsing pipes
│   ├── ui/
│   │   ├── graph-editor.js    Graph editor Web Component
│   │   └── data-viewer.js     Text/hex viewer Web Component
│   └── worker/
│       ├── worker-pool.js     Worker lifecycle and task queue
│       └── pipe-worker.js     Worker-side pipe dispatch
├── styles/
│   ├── main.css            Shared tokens, reset, and shell layout
│   ├── controls.css        Buttons, menus, and toolbar controls
│   ├── graph.css           Graph editor, nodes, ports, and connections
│   ├── data-viewer.css     Data panel and byte viewers
│   ├── dialogs.css         Dialogs and configuration forms
│   └── feedback.css        Popovers, scrollbars, and toasts
├── tests/                     Vitest unit and integration tests
├── assets/                    Static artwork
└── .github/workflows/         CI, Pages deployment, and agent setup
```

For product features and usage, see the root
[`README.md`](../README.md).
