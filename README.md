# home-core

Monorepo using Turborepo + pnpm with:
- apps/web: Vite + React 18
- apps/api: Fastify (TypeScript)
- packages/*: shared UI, utils, types, and configs

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

## Run (production-like)
- API:
```
pnpm start:api   # builds then starts Node on 3001
```
- Web (static preview):
```
pnpm start:web   # builds then serves on 4173
```

## Working with dependencies
- App-only dep: `pnpm add <pkg> --filter @home/web`
- API-only dep: `pnpm add <pkg> --filter @home/api`
- Shared package dep: `pnpm add <pkg> --filter @home/ui`
- Dev-only dep: add `-D`
- Internal packages use `"workspace:*"` versions

See `AGENTS.md` for LLM contribution guidance.
