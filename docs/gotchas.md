# Maintainer gotchas

## Architectural constraints

- There is no compilation or bundling. Browser-supported syntax, explicit
  relative `.js` imports, and correctly cased paths are production
  requirements.
- Pipe I/O is bytes. Keep `null` (absent) distinct from an empty byte array.
- The graph must remain acyclic. `connect()` returns `null` for invalid
  connections and silently replaces an existing source for the same input.
- `processFrom()` uses a depth-first downstream order. Preserve upstream-first
  dependencies when changing graph traversal.

## Coupled registrations

The UI/deserializer registry and worker allowlist are separate by design. When
adding or renaming a worker-executed pipe, update both
`src/pipes/registry.js` and `src/worker/pipe-worker.js`, plus their tests.
Stable `typeName` values are persisted in URLs and IndexedDB.

## Dynamic ports

URL, JSON, and regex parsers derive ports from current input. They must clear
stale dynamic definitions on every run, return their new definitions across
the worker boundary, and keep output maps and rendered ports synchronized.
Test changing from one dynamic shape to another, not just the first run.

## Serialization and URL size

Every graph change schedules the entire graph in the `g` query parameter.
Input text and file data are therefore part of shared URLs. File Input stores
bytes as base64 configuration so the graph stays JSON serializable. Large
graphs create large URLs; there is no server-side or compressed fallback.

Do not casually change serialized property names, pipe IDs, type names, port
names, or config names. Existing URLs and local sessions depend on them.

## Main-thread and worker behavior

The worker pool can contain multiple workers, but current graph traversal
awaits pipes one at a time. Do not assume graph branches execute concurrently.
Worker messages copy bytes through number arrays rather than transferring
buffers, which is simple but can be expensive for large data.

`Pipe.run()` and worker synchronization both clear or replace errors and
outputs. Ensure failures cannot leave stale output visible.

## Text handling

`StringPipe` decodes using its configured encoding but encodes output as UTF-8.
Use the dedicated charset pipes when the output byte encoding itself matters.
Test malformed sequences with fatal decoding and test non-ASCII input.

## UI coordination

`GraphEditor` renders the graph but does not own the model. Application code
must update `PipeGraph`, corresponding DOM nodes, and SVG connections together.
Custom DOM events are the boundary between the component and `app.js`.

Tests run in jsdom with shims. Passing tests do not replace checking pointer,
touch, browser worker, clipboard/share, and IndexedDB behavior in a real
browser when those areas change.

## Security and data handling

Worker dispatch must remain restricted to known constructors. Render
user-controlled values with `textContent`, not HTML injection APIs. Graph URLs
and named sessions may contain user-provided data, so treat deserialized state
as untrusted and tolerate unknown pipe types.
