# home-core

Monorepo using Turborepo + pnpm with:
- apps/web: Vite + React 18
- apps/api: Fastify (TypeScript)
- packages/*: shared UI, utils, types, and configs

Includes shared Zod v4 schemas in `packages/types` used by both API and Web.

## Requirements
- Node 20 (see `.nvmrc`)
- Corepack enabled (`corepack enable`)

## Install
```
pnpm install
```

## Scripts
- `pnpm dev`: run all apps in watch mode (parallel)
- `pnpm dev:web`: run the web app only (http://localhost:5173)
- `pnpm dev:api`: run the API only (http://localhost:3001)
- `pnpm build`: build all apps and packages
- `pnpm typecheck`: type-check all workspaces
- `pnpm lint`: lint all workspaces
- `pnpm start:web`: build then preview the web app (http://localhost:4173)
- `pnpm start:api`: build then start the API (http://localhost:3001)

## Develop
Most day-to-day work uses `pnpm dev`.
```
pnpm dev
```
Or filter to a single app:
```
pnpm dev:web
pnpm dev:api
```

During development, the Web app proxies `/api/*` to the API (see `apps/web/vite.config.ts`).

## Linting & Formatting
- ESLint v9 flat config at the repo root: `eslint.config.js`
- No per-package `.eslintrc.*` files (by design)
- Prettier config at `.prettierrc.json`

## Typescript
- Strict settings via shared configs in `packages/tsconfig`
- `typecheck` depends on upstream builds so apps can typecheck against built internal packages

## Build
```
pnpm build
```
Outputs go to `dist/` per package/app.

## E2E Tests (Playwright)
- Install browsers once: `pnpm e2e:install`
- Run headless tests: `pnpm test:e2e`
- Open UI mode: `pnpm test:e2e:ui`

Notes:
- Tests auto-start both servers: `pnpm dev:api` (http://localhost:3001) and `pnpm dev:web` (http://localhost:5173).
- The default smoke test verifies the homepage and user details fetched from `/api/user`.

## Run (production-like)
- API:
```
pnpm start:api   # builds then starts Node on 3001
```
- Web (static preview):
```
pnpm start:web   # builds then serves on 4173
```

## API + Web integration
- API routes live under `/api/*`.
- In non‑dev environments, the API also serves the built Web SPA from `apps/web/dist` with an SPA fallback for non‑`/api` routes.
- In dev, static serving is disabled; Vite serves the Web app and proxies `/api` to the Fastify server.

## Shared Zod schemas
- Zod v4 is used for request/response schemas shared via `@home/types`.
- Location: `packages/types/src/schemas/*`
- Example exports: `UserSchema`, `apiResponse(UserSchema)`; re‑exported from `packages/types/src/index.ts`.
- API handlers should validate payloads and return `ApiResponse<T>`; Web should parse API responses using the shared schemas.

## Working with dependencies
- App-only dep: `pnpm add <pkg> --filter @home/web`
- API-only dep: `pnpm add <pkg> --filter @home/api`
- Shared package dep: `pnpm add <pkg> --filter @home/ui`
- Dev-only dep: add `-D`
- Internal packages use `"workspace:*"` versions

See `AGENTS.md` for LLM contribution guidance. Commands and scripts are documented here as the canonical source to keep docs DRY.
