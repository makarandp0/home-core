# LLM Operator Guide

This repository is designed for LLM-driven contributions. Follow these rules to make precise, safe, and helpful changes.

**Technical reference:** See `README.md` for complete tech stack, commands, scripts, and environment setup.

## Mission

- Make minimal, targeted diffs that solve the task at the root cause.
- Keep code consistent with the existing style and structure.
- Prefer clarity and maintainability over cleverness.

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
3. Validate locally (see [Scripts](README.md#scripts) in `README.md` for commands):
   - Run typecheck, lint, and build from repo root
   - Note: `typecheck` depends on upstream builds so apps can typecheck against built internal packages
   - Use dev servers to verify changes; web proxies `/api` to API during development
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

See [Working with dependencies](README.md#working-with-dependencies) in `README.md` for pnpm filter commands.

**Operator rules:**
- Always use `"workspace:*"` versions for internal packages
- Verify dependencies are added to the correct workspace

## Checks Before PR

Run standard validation commands (see [Scripts](README.md#scripts) in `README.md`): build, typecheck, and lint.

**Additional checks:**
- For UI changes: verify visual usage in `apps/web` manually
- Conventional commit message (e.g., `feat:`, `fix:`, `chore:`)

## E2E UI Testing

- Playwright config lives at the repo root: `playwright.config.ts`.
- DRY source of truth for commands: see "E2E Tests (Playwright)" in `README.md`.
- Tests start both API and Web servers and validate UI against API responses.

## Deployment model

See [API + Web integration](README.md#api--web-integration) in `README.md` for deployment architecture.

**Key constraint:** API routes must be namespaced under `/api/*` to avoid conflicts with SPA routing.

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
