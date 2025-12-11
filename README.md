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

## Develop
- All apps in parallel:
```
pnpm dev
```
- Web only:
```
pnpm dev:web   # http://localhost:5173
```
- API only:
```
pnpm dev:api   # http://localhost:3001
```

## Build
```
pnpm build
```

## Run (production-like)
- API:
```
pnpm start:api   # builds then starts Node on 3001
```
- Web (static preview):
```
pnpm start:web   # builds then serves on 4173
```

## Quality
```
pnpm typecheck
pnpm lint
```

See `AGENTS.md` for LLM contribution guidance.
