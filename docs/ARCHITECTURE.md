# Architecture Overview

## Monorepo Layout

- apps/
  - web/ — Vite + React (client app)
  - api/ — Fastify (HTTP API)
- packages/
  - ui/ — Reusable React components (Tailwind)
  - utils/ — Generic helpers
  - types/ — Shared types
  - tsconfig/ — Shared TS configs
  - eslint-config/ — Shared ESLint config
  - tailwind-config/ — Shared Tailwind preset

## Build & Tasks

- Task runner: Turborepo (`turbo.json`)
- Package manager: pnpm (`pnpm-workspace.yaml`)
- TypeScript strict across all packages
- ESLint + Prettier enforced; CI checks typecheck/lint/build

## Key Decisions

- Plain React app (no Next.js) using Vite
- Fastify for API with simple JSON contracts and logging
- Tailwind for styling via shared preset

## How Things Fit

- `apps/web` depends on `@home/ui`, `@home/utils`, and shares types from `@home/types`.
- `apps/api` uses server tsconfig and may import types from `@home/types`.
- Shared configs avoid duplication and keep consistent lint/ts settings.
