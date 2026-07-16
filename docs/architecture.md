# Runtime architecture

## Composition

`index.html` loads `src/app.js`. During initialization, `app.js`:

1. Creates a `PipeGraph`.
2. Creates a `WorkerPool` using `src/worker/pipe-worker.js`;
3. Attaches the graph to the `<graph-editor>`;
4. Loads a serialized graph from the URL when present;
5. Registers graph, toolbar, dialog, viewer, and persistence handlers; and
6. Schedules the initial URL synchronization.

`app.js` is the composition root. The model and reusable components do not
import it.

## Graph and data flow

`src/pipes/graph.js` stores pipes in a `Map` and directed port-to-port
connections in an array. A connection identifies a source pipe/output and a
destination pipe/input.

The graph rejects self-connections and cycles. Each input port has at most one
incoming connection; connecting a new source to an occupied input replaces the
old connection. One output may fan out to multiple inputs.

`processAll()` computes an upstream-first topological order. `processFrom(id)`
walks the selected pipe and its descendants. In both cases, graph orchestration
awaits each pipe in order, even though the worker pool can queue independent
tasks. Before a pipe runs, connected upstream output data is copied into its
input map.

All pipe data is `Uint8Array` or `null`. `null` means no data; an empty
`Uint8Array` is valid empty data. Errors are retained as `PipeError` values
instead of escaping normal pipe execution.

## Worker boundary

`src/worker/worker-pool.js` lazily creates module workers, up to at least two
workers or `navigator.hardwareConcurrency`, whichever is larger. It assigns
message IDs, queues work when every worker is busy, and replaces failed
workers.

Messages use plain objects. Inputs and outputs are converted between
`Uint8Array` and number arrays at the boundary. The worker:

1. resolves the requested type from its fixed registry;
2. restores configuration and inputs;
3. runs the pipe;
4. serializes output data and errors; and
5. returns dynamic output definitions when present.

The fixed worker registry prevents arbitrary constructor dispatch.

## UI boundary

`src/ui/graph-editor.js` owns the visual graph, SVG connections, pipe nodes,
dragging, panning, zooming, pointer/touch gestures, and connection drafts. It
communicates upward with DOM custom events rather than importing application
state.

`src/ui/data-viewer.js` renders bytes as text or colorized hex and supports
editing when `app.js` enables it for an Input Buffer output.

`app.js` translates UI events into graph mutations and translates graph events
back into editor and data-view updates. Graph and editor state must therefore
be updated together when importing, adding, or removing nodes.

## Persistence

`src/state.js` supports two forms:

- Shareable state: graph JSON is base64url encoded in the `g` query parameter.
  Changes are written with `history.replaceState`, debounced by `app.js`.
- Named local sessions: records are stored in IndexedDB database
  `encode-o-matic`, object store `graphs`, keyed by session name.

Serialized pipes contain IDs, stable type names, configuration values, and
positions. Connections contain their four endpoint fields. Changing that
format can break existing shared URLs and saved sessions.

## Guess Encoding

`src/guess.js` searches registered non-input pipes whose static
`getInputAppropriateness()` score is positive. A candidate is followed only
when its default output is a non-empty `Uint8Array` shorter than its input.
Memoization is keyed by the bytes. The longest chain wins; scores break ties
from left to right. `app.js` replaces the current graph with an Input Buffer
and the selected chain.
