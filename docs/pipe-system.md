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

## Naming conventions for pipe inputs and outputs

- Use `input` and `output` as the default single-port names.
- Source pipes should still use `output` for their main output, even when they
  expose no inputs.
- Prefer semantic names for multi-output pipes (`href`, `protocol`, `json`,
  `match`) so downstream wiring stays readable.
- For dynamic outputs, use a stable prefix plus source key:
  - `query:${name}` for URL query parameters
  - `key:${name}` for JSON object keys
  - `group:${index}` for regex capture groups
- Treat port names as stable API. Renaming breaks saved graphs, connections,
  and worker/main-thread output synchronization.

## Naming conventions for pipes

- Keep `static typeName` stable and machine-oriented (PascalCase, no spaces),
  e.g. `HexEncode`, `UrlParser`, `RegexMatch`.
- Use class names ending in `Pipe` (`HexEncodePipe`, `JsonParserPipe`) and keep
  `typeName` aligned with worker and main-thread registry entries.
- Use human-readable `typeDescription` labels for UI display (`Hex Encode`,
  `JSON Parser`).
- Keep encode/decode pairs and parser names consistent with existing patterns
  so ordering, discoverability, and guessing behavior remain predictable.

## Best practices and common patterns for pipe configs

- Define configs in `defineConfigs()` with stable `name` keys and clear
  user-facing descriptions.
- Prefer camelCase config names (`rawBytes`, `escapeNonAscii`, `fromEncoding`).
- Use serializable default values and keep defaults aligned with tests.
- Reuse existing config type patterns used by the UI:
  `string`, `number`, `boolean`, `select`, `text`, `bytes`, `hidden`.
- Use `hidden` for internal state not shown in the config dialog
  (for example InputPipe `rawBytes`).
- Preserve established paired-config conventions where needed (for example
  `fileData` + `fileName` on file input).
- For `StringPipe` subclasses, include `...super.defineConfigs()` unless you are
  intentionally removing the shared `encoding` option.

## Best practices for pipe errors

- Throw `PipeError` for expected user-facing failures (invalid input, malformed
  encoding, parse errors).
- Keep error messages specific and actionable (`Invalid JSON: ...`,
  `Hex string has odd number of digits`).
- Provide `selections` with byte ranges when the error maps to a precise input
  location so the data viewer can highlight trigger bytes.
- Use UTF-8 byte offsets for selections, not JavaScript string indices.
- Let `run()` wrap unexpected exceptions into `PipeError` rather than duplicating
  generic catch/rethrow code in every pipe.

## Best practices for cursor / selection behavior

- Use the shared selection shape `{ index, length }[]` with non-negative,
  finite byte offsets and positive lengths.
- Implement `translateSelections()` when output byte positions can be mapped
  to/from input positions (for example hex encode/decode).
- Return `null` when a pipe cannot reliably translate selection coordinates.
- Translate in both directions where possible so upstream/downstream selection
  propagation remains symmetric in the graph.
- Base translation math on encoded byte positions to handle non-ASCII text
  correctly.
- Attach error selections to the relevant input byte ranges, since error
  highlights are applied to input views.

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

## Maintainer input requested

Please help confirm these conventions before we treat them as strict policy:

- Inputs/outputs: should we reserve `input`/`output` for single-port pipes and
  require `prefix:name` for all dynamic outputs?
- Pipe naming: should `typeName` always be PascalCase with no `Pipe` suffix,
  while class names always keep the `Pipe` suffix?
- Configs: should we explicitly document the full supported config-type list in
  `PipeConfig` JSDoc to match current UI behavior?
- Errors: should all validation failures include selections whenever a byte span
  can be identified, and should we add tests for that expectation?
- Cursor/selection: should every reversible transform pipe be required to
  implement bidirectional `translateSelections()` coverage in tests?
