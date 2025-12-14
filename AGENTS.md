# LLM Operator Guide

This repository is designed for LLM-driven contributions. Follow these rules to make precise, safe, and helpful changes.

## Mission

- Make minimal, targeted diffs that solve the task at the root cause.
- Keep code consistent with the existing style and structure.
- Prefer clarity and maintainability over cleverness.

## Tech Stack

- Monorepo: Turborepo + pnpm workspaces
- Apps: `apps/web` (Vite + React 18), `apps/api` (Fastify)
- Shared packages: `packages/utils`, `packages/types`, `packages/tsconfig`, `packages/tailwind-config`
- Validation: Zod v4 shared schemas in `@home/types`
- Linting: ESLint v9 flat config at repo root (`eslint.config.js`) + Prettier (do not use `packages/eslint-config` for project config)
- Other: Tailwind, Changesets, GitHub Actions CI

## Ground Rules

- Scope: Only change what is required to satisfy the task.
- Structure: Do not rename or move files unless compelling; follow existing patterns.
- Styling: Use Tailwind utility classes in UI. Keep React components simple and typed.
- Types: TS is strict; extend `@home/tsconfig` presets per target (app/library/server).
- Type assertions: Explicit `as` type assertions (e.g. `x as Foo`) are banned. Prefer safe narrowing, typed generics, or helper functions. Enforcement: root ESLint rule using the `TSAsExpression` selector in `eslint.config.js`.
- Exports: Do not use default exports in app/library code. Prefer named exports and named imports for clarity and refactor safety. Exception: external tool config files that require default exports (e.g., `vite.config.ts`, `playwright.config.ts`).
- Packages: Use workspace ranges (`workspace:*`) for internal deps.
- Linting: Use the root flat config. Do not add per-package `.eslintrc.*` files.
- Formatting: Always run Prettier on any edits. Before pushing, run `pnpm format` (see README for commands) or enable editor format-on-save with the Prettier extension to keep diffs consistent.
- Turborepo: Use `tasks` (Turbo v2); do not introduce deprecated `pipeline` keys.
- No license headers or unrelated refactors.
- Secrets: Never commit `.env` or credentials.
- Docs (DRY): Keep documentation DRY. Treat `README.md` as the canonical source for commands, scripts, and environment usage; link to it from `AGENTS.md` instead of duplicating. Use `AGENTS.md` for operator-specific constraints, workflows, and pointers.

## Workflow for LLMs

1. Understand task and plan small, verifiable steps.
2. Apply changes surgically. Prefer small patches.
3. Validate locally:
   - Root checks: `pnpm typecheck`, `pnpm lint`, `pnpm build`
   - Dev servers: `pnpm dev` (or `pnpm dev:web`, `pnpm dev:api`) — Web proxies `/api` to API
   - Note: `typecheck` depends on upstream builds so apps can typecheck against built internal packages.
4. Update docs when adding packages or features: ensure both `README.md` and `AGENTS.md` reflect the change; keep updates concise and current.
5. Prepare PR description using the template; list affected paths.

## Repo Conventions

- UI: Keep UI components in `apps/web/src/components`.
- Utils/Types: Keep small, generic helpers in `packages/utils` and shared types in `packages/types`.
- Shared schemas: Define Zod v4 schemas under `packages/types/src/schemas/*`; export via `packages/types/src/index.ts`.
- API: Add routes in `apps/api/src`, keep handlers small and typed, return `ApiResponse<T>` and validate/parse using shared Zod schemas.
- Web: Keep pages and feature code in `apps/web/src`, fetch from `/api/*`, and validate responses with shared Zod schemas using `apiResponse(YourSchema)`.

## Commits

- Use clear, conventional-style messages when possible (e.g., `feat:`, `fix:`, `chore:`).
- Keep diffs small and focused; separate unrelated changes into different commits/PRs.

## Adding Dependencies

- App-only: `pnpm add <pkg> --filter @home/web`
- API-only: `pnpm add <pkg> --filter @home/api`
- Shared package: `pnpm add <pkg> --filter @home/types` (or @home/utils)
- Dev-only: add `-D`.
- Internal linking: prefer `"workspace:*"` versions for internal packages.

## Checks Before PR

- Build passes: `pnpm build`
- Typecheck all: `pnpm typecheck`
- Lint clean: `pnpm lint`
- For UI changes: verify visual usage in `apps/web` manually.

## E2E UI Testing

- Playwright config lives at the repo root: `playwright.config.ts`.
- DRY source of truth for commands: see "E2E Tests (Playwright)" in `README.md`.
- Tests start both API and Web servers and validate UI against API responses.

## Deployment model

- API routes are namespaced under `/api`.
- In non‑dev environments, the API serves the built Web SPA with a fallback for non‑API routes.
- In dev, static serving is disabled in the API; use Vite dev server for the Web app.

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
