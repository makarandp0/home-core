# LLM Operator Guide

This repository is designed for LLM-driven contributions. Follow these rules to make precise, safe, and helpful changes.

## Mission
- Make minimal, targeted diffs that solve the task at the root cause.
- Keep code consistent with the existing style and structure.
- Prefer clarity and maintainability over cleverness.

## Tech Stack
- Monorepo: Turborepo + pnpm workspaces
- Apps: `apps/web` (Vite + React 18), `apps/api` (Fastify)
- Shared packages: `packages/ui`, `packages/utils`, `packages/types`, `packages/tsconfig`, `packages/tailwind-config`
- Linting: ESLint v9 flat config at repo root (`eslint.config.js`) + Prettier (do not use `packages/eslint-config` for project config)
- Other: Tailwind, Changesets, GitHub Actions CI

## Ground Rules
- Scope: Only change what is required to satisfy the task.
- Structure: Do not rename or move files unless compelling; follow existing patterns.
- Styling: Use Tailwind utility classes in UI. Keep React components simple and typed.
- Types: TS is strict; extend `@home/tsconfig` presets per target (app/library/server).
- Packages: Use workspace ranges (`workspace:*`) for internal deps.
- Linting: Use the root flat config. Do not add per-package `.eslintrc.*` files.
- Turborepo: Use `tasks` (Turbo v2); do not introduce deprecated `pipeline` keys.
- No license headers or unrelated refactors.
- Secrets: Never commit `.env` or credentials.

## Workflow for LLMs
1. Understand task and plan small, verifiable steps.
2. Apply changes surgically. Prefer small patches.
3. Validate locally:
   - Root checks: `pnpm typecheck`, `pnpm lint`, `pnpm build`
   - Dev servers: `pnpm dev` (or `pnpm dev:web`, `pnpm dev:api`)
   - Note: `typecheck` depends on upstream builds so apps can typecheck against built internal packages.
4. Update or add docs when adding packages or features.
5. Prepare PR description using the template; list affected paths.

## Repo Conventions
- UI: Put reusable components in `packages/ui/src/lib`, export from `packages/ui/src/index.ts`.
- Utils/Types: Keep small, generic helpers in `packages/utils` and shared types in `packages/types`.
- API: Add routes in `apps/api/src`, keep handlers small and typed, return JSON shapes with `ApiResponse<T>` where appropriate.
- Web: Keep pages and feature code in `apps/web/src`, prefer simple component composition.

## Commits
- Use clear, conventional-style messages when possible (e.g., `feat:`, `fix:`, `chore:`).
- Keep diffs small and focused; separate unrelated changes into different commits/PRs.

## Adding Dependencies
- App-only: `pnpm add <pkg> --filter @home/web`
- API-only: `pnpm add <pkg> --filter @home/api`
- Shared package: `pnpm add <pkg> --filter @home/ui`
- Dev-only: add `-D`.
- Internal linking: prefer `"workspace:*"` versions for internal packages.

## Checks Before PR
- Build passes: `pnpm build`
- Typecheck all: `pnpm typecheck`
- Lint clean: `pnpm lint`
- For UI changes: verify visual usage in `apps/web` manually.

## PR Expectations
- Summary: What/why and user impact.
- Scope: Explicitly list touched packages and files.
- Risk: Call out breaking changes or migrations.
- Validation: Mention commands run and evidence.

## CI
- CI runs lint, typecheck, and build on PRs and `main`.

## Non-Goals for LLMs (unless asked)
- Do not add new build tools, compilers, or swap frameworks.
- Do not mass-rewrite code for style-only changes.
- Do not introduce testing frameworks without direction.
