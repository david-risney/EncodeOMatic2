# Pipe system

## Core contract

`src/pipes/pipe.js` defines:

- `PipeConfig`: a named configuration value and its UI metadata.
- `PortDef`: a named input or output, optionally marked as the default.
- `PipeError`: a message plus optional byte selection ranges.
- `Pipe`: the base data model and execution lifecycle.

A pipe subclass normally supplies stable static metadata (`typeName`,
`typeDescription`, `category`, and `categoryDescription`) and overrides
`process(inputs)`. It may also override `defineInputs()`, `defineOutputs()`,
`defineConfigs()`, and static `getInputAppropriateness(input)`.

`process()` receives a `Map` of port names to bytes and returns a `Map` of
output names to bytes. `run()` clears stale outputs and errors first, accepts
only declared outputs in main-thread execution, and turns thrown values into
`PipeError`.

## Text pipes

`src/pipes/string-pipe.js` is for transformations most naturally expressed as
text. It decodes input with the selected `TextDecoder` encoding in fatal mode,
calls `processString()`, and emits UTF-8 through `TextEncoder`. Extending it is
appropriate only when UTF-8 output matches the intended pipe behavior.

## Built-ins

Built-ins are grouped under `src/pipes/builtin/`:

- Inputs: editable text bytes and file bytes.
- Encoding: Base64, percent, hex, HTML entities, XML entities, charset,
  binary, slash escapes, and whole-URL encoding, generally in encode/decode
  pairs.
- Parsing: URL, JSON, and regular expression pipes.

URL, JSON, and regex parsing can create dynamic outputs from query parameters,
top-level keys, or capture groups. These pipes rebuild `_dynamicOutputs` while
processing. Worker results include those definitions so `PipeGraph` can update
the main-thread model before the editor redraws ports.

## Registration

`src/pipes/registry.js` is the main-thread source of built-in display order,
creation, deserialization, categories, and guessing candidates.

`src/worker/pipe-worker.js` has a separate allowlisted registry for worker
dispatch. Processing-capable types intended to run in workers must use exactly
the same stable `typeName` in both places. A renamed type also affects
serialized graphs.

## Adding or changing a pipe

1. Put the implementation in the matching `builtin` category and extend
   `Pipe` or `StringPipe`.
2. Define stable metadata, ports, configurations, processing, errors, and
   appropriateness scoring where useful.
3. Add it to the ordered main-thread registry.
4. If it should execute in a worker, import and allowlist it in
   `pipe-worker.js`.
5. Add focused pipe tests. Cover empty, malformed, non-ASCII, and arbitrary
   byte input as applicable.
6. Update graph/worker tests for registration or dynamic-port behavior and UI
   tests when configuration rendering changes.
7. Run the validation commands in [development.md](development.md).

Preserve the distinction between bytes and text. Do not pass strings between
pipes or add side channels around named ports.
