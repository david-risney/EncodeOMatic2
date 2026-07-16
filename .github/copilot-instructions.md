# Copilot instructions

EncodeOMatic2 is a client-side JavaScript application with no build step. Keep
changes focused and preserve the existing pipe architecture.

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

- Always capture at least one screenshot after implementing a change that can be demonstrated in the rendered application.
- Include the screenshots in the agent session's progress updates and final response so they are visible while reviewing the work.
- Include the same screenshots in the pull request description.
- For changes with no visual or renderable result, explicitly state that screenshots are not applicable instead of omitting them without explanation.
