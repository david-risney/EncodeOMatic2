# Copilot instructions

EncodeOMatic2 is a client-side JavaScript application with no build step. Keep
changes focused and preserve the existing pipe architecture.

Use [`docs/index.md`](../docs/index.md) as the codebase documentation entry
point. Read only the topic guides relevant to the current task so detailed
documentation is loaded on demand rather than included in every Copilot
context.

Before editing:

- Turn the request into explicit acceptance criteria, including relevant edge
  cases and validation.
- Inspect the affected implementation and tests. Run independent searches or
  investigations in parallel when possible.
- Reuse existing pipe and UI patterns rather than introducing new abstractions.

Before completing code changes, run:

```sh
npm run check
npm test
```

For pull request reviews, prioritize functional regressions, security issues,
missing edge-case coverage, and violations of the pipe architecture. Do not
report formatting or stylistic preferences unless they affect correctness.

## Screenshots

- For a change that can be demonstrated in the rendered application, attempt to capture at least one screenshot.
- Include successful screenshots in the agent session's progress updates, final response, and pull request description.
- Screenshot capture or attachment failures are non-blocking; do not fail an otherwise successful task solely because screenshots could not be produced or displayed.
- If screenshots are unavailable for a renderable change, explicitly state that capture/display failed and continue with the rest of the deliverable.
- For changes with no visual or renderable result, explicitly state that screenshots are not applicable instead of omitting them without explanation.
