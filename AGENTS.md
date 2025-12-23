# Contributing

Development setup, commands, and contribution guidelines for home-core.

## Requirements

- Node 22.18.0 (see `.nvmrc`)
- Corepack enabled (`corepack enable`)
- Docker (for local PostgreSQL)
- Python 3.11+ and [uv](https://docs.astral.sh/uv/) (for doc-processor only)

## Setup

```bash
pnpm install
```

Start PostgreSQL:
```bash
docker compose up postgres -d
```

Run database migrations:
```bash
pnpm --filter @home/db migrate:up
```

For doc-processor (Python service):
```bash
pnpm setup:doc-processor
```

## Development

Run all services in watch mode:
```bash
pnpm dev
```

Or run individually:
```bash
pnpm dev:web           # http://localhost:5173
pnpm dev:api           # http://localhost:3001
pnpm dev:doc-processor # http://localhost:8000
```

The web app proxies `/api/*` to the API during development (see `apps/web/vite.config.ts`).

## Build & Typecheck

```bash
pnpm build      # Build all apps and packages
pnpm typecheck  # Type-check all workspaces (depends on build)
pnpm lint       # Lint all workspaces
```

Note: `typecheck` depends on upstream builds so apps can typecheck against built internal packages.

## Project Structure

```
apps/
  web/          # Vite + React 18 frontend
  api/          # Fastify (TypeScript) backend
  doc-processor/# FastAPI (Python) document service
packages/
  db/           # Database client and migrations (@home/db)
  types/        # Shared Zod v4 schemas (@home/types)
  utils/        # Shared utilities (@home/utils)
  tsconfig/     # Shared TypeScript configs
```

## Database

PostgreSQL with Drizzle ORM for type-safe queries and node-pg-migrate for migrations.

### Local Development

```bash
docker compose up postgres -d              # Start Postgres
pnpm --filter @home/db migrate:up          # Run migrations
```

### Migration Workflow

```bash
# Create a new migration
pnpm --filter @home/db migrate:create add-users-table

# Edit the migration file in packages/db/migrations/

# Run pending migrations
pnpm --filter @home/db migrate:up

# Regenerate Drizzle schema from database
pnpm --filter @home/db db:introspect

# Update packages/db/src/schema/index.ts to export new tables
```

### Migration Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @home/db migrate:create <name>` | Create new migration |
| `pnpm --filter @home/db migrate:up` | Run pending migrations |
| `pnpm --filter @home/db migrate:down` | Rollback last migration |
| `pnpm --filter @home/db migrate:status` | Show migration status |
| `pnpm --filter @home/db db:introspect` | Generate schema from DB |

### Using the Database in API

```typescript
import { getDb, eq } from '@home/db';
import { documents } from '@home/db';

const db = getDb();
const docs = await db.select().from(documents).where(eq(documents.id, id));
```

## Code Conventions

- **TypeScript**: Strict mode via shared configs in `packages/tsconfig`
- **Styling**: Tailwind utility classes in UI
- **Exports**: Named exports only (no default exports except config files)
- **Type assertions**: `as` casts are banned; use safe narrowing or typed generics
- **Internal deps**: Use `"workspace:*"` versions

## Shared Schemas

Zod v4 schemas live in `packages/types/src/schemas/*` and are shared by API and Web:
- API validates payloads and returns `ApiResponse<T>`
- Web parses responses with `apiResponse(YourSchema)`

## Adding Dependencies

```bash
pnpm add <pkg> --filter @home/web   # Web only
pnpm add <pkg> --filter @home/api   # API only
pnpm add <pkg> --filter @home/types # Shared package
pnpm add -D <pkg> --filter ...      # Dev dependency
```

## Linting & Formatting

- ESLint v9 flat config at repo root: `eslint.config.js`
- Prettier config: `.prettierrc.json`
- Run `pnpm format` before committing

## E2E Tests (Playwright)

```bash
pnpm e2e:install  # Install browsers (once)
pnpm test:e2e     # Run headless
pnpm test:e2e:ui  # Open UI mode
```

Tests auto-start both servers.

## Production Build

```bash
pnpm start:api  # Build and start API on :3001
pnpm start:web  # Build and preview web on :4173
```

## Architecture Notes

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Web App   │────▶│   Fastify API    │────▶│   Doc Processor     │
│  (React)    │     │   (Node.js)      │     │  (Python/FastAPI)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
     :5173               :3001                      :8000
                           │
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    └──────────────┘
                         :5432
```

- API routes are namespaced under `/api/*`
- In production, API serves the web SPA from `apps/web/dist` with SPA fallback
- In dev, Vite serves the web and proxies `/api` to Fastify

## Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `chore:`
- Keep diffs small and focused
- Never commit `.env` or credentials

## PR Checklist

- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] For UI changes: verified visually
- [ ] Docs updated if adding features

## Common Gotchas

- Run `pnpm build` before `pnpm typecheck` — typecheck depends on built packages
- Restart dev servers after changing shared schemas in `@home/types`
<!-- TODO: Add more gotchas as discovered -->

## Debugging

- API logs print to console in dev mode
- Web: React DevTools + Network tab
- Doc Processor: uvicorn logs to console
<!-- TODO: Add more debugging tips -->

## Quick Reference

| Task | Location |
|------|----------|
| Add API route | `apps/api/src/routes/` |
| Add React component | `apps/web/src/components/` |
| Add shared type/schema | `packages/types/src/schemas/` |
| Add database migration | `packages/db/migrations/` |
| Add database table | `packages/db/src/schema/` |

## LLM Operators

Additional rules for AI-assisted contributions:

- Make minimal, targeted diffs
- Only change what's required for the task
- Do not rename/move files unless necessary
- Do not add new build tools or frameworks without direction
- Do not mass-rewrite code for style-only changes
