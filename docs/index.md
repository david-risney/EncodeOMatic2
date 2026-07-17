# EncodeOMatic2 codebase guide

This directory is the entry point for repository-oriented documentation. Start
here, then open only the topic needed for the task. This keeps Copilot's
automatically loaded context small while making deeper context discoverable.

## Documentation map

- [Repository overview](overview.md) — purpose, technologies, entry points, and
  directory layout.
- [Runtime architecture](architecture.md) — application startup, graph
  execution, workers, UI events, state, and encoding-chain guessing.
- [Pipe system](pipe-system.md) — the pipe contract, built-ins, registration,
  dynamic ports, and the steps for adding a pipe.
- [Development and testing](development.md) — local setup, validation, test
  organization, CI, and deployment.
- [UX design language](design-language.md) — visual principles, design tokens,
  spacing, typography, components, interaction patterns, and responsive rules.
- [Maintainer gotchas](gotchas.md) — constraints and easy-to-miss coupling
  between modules.
- [Version management](version.md) — how the version is stored, why every
  change needs a bump, and how to run the bump script.

## How the hierarchy works

The repository's auto-loaded instructions at
[`../.github/copilot-instructions.md`](../.github/copilot-instructions.md)
point to this index, not to every guide. Agents and contributors should:

1. Read this index to identify the relevant topic.
2. Load only the linked guide or guides needed for the current change.
3. Inspect the source and tests named by those guides; the documentation is a
   map, not a replacement for current code.
4. Update the relevant guide when a change makes it inaccurate.

The root [`README.md`](../README.md) remains the user-facing product and usage
introduction. The files here focus on implementation and maintenance.
