# LLM Task Templates

## Feature Implementation

Context:

- What problem are we solving and for whom?
- Affected packages/apps:

Requirements:

- [ ] Add/modify components or routes (list)
- [ ] Type-safe changes; TS passes
- [ ] Lint/build pass

Out of Scope:

- Items explicitly not to change

Validation:

- Commands run and manual steps

## Bug Fix

Bug:

- What is broken, reproduction steps, expected vs actual

Fix Plan:

- Root cause hypothesis and targeted change

Checks:

- [ ] Add/adjust types if needed
- [ ] Lint/build pass

## Refactor

Motivation:

- Why now and what improves?

Constraints:

- No behavior change; same API

Checks:

- [ ] Typecheck/lint/build
- [ ] No public API breakage
