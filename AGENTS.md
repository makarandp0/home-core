# Contributing

Development setup, commands, and contribution guidelines for home-core.

## Requirements

- Node 22.18.0 (see `.nvmrc`)
- Corepack enabled (`corepack enable`)
- Docker (for local PostgreSQL)
- Python 3.11+ and [uv](https://docs.astral.sh/uv/) (for doc-processor only)

## Setup

```bash
pnpm bootstrap   # Install deps, start Postgres, run migrations, set up doc-processor, build
```

The bootstrap script will automatically reuse an existing home-core PostgreSQL container if one is already running (e.g., from another worktree or directory).

## Development

### Starting a New Feature

The typical development flow starts by creating a git worktree:

```bash
pnpm worktree:add feature_name   # Creates ../feature_name with full setup (deps, build, .env)
cd ../feature_name
pnpm dev                          # Ports auto-assigned based on branch name
```

This creates an isolated workspace sharing the same git history and PostgreSQL container.

### Running Services

Run all services (web, API, and doc-processor) in watch mode:

```bash
pnpm dev
```

Web and API ports are automatically offset based on branch name for parallel development across worktrees. PostgreSQL and doc-processor run as shared instances on fixed ports (5432, 8000).

The web app proxies `/api/*` to the API during development (see `apps/web/vite.config.ts`).

### Mobile Testing

The dev server is exposed on the network by default. Find your URL in the dev output:

```
  Web:           http://localhost:5873
  Web (network): http://192.168.1.x:5873   <- Use this on your phone
```

If `qrencode` is installed (`brew install qrencode`), a QR code is displayed for easy scanning. Both devices must be on the same WiFi network.

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

PostgreSQL with Drizzle ORM for type-safe queries and node-pg-migrate for migrations. Bootstrap handles starting Postgres and running migrations.

### Creating Migrations

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

| Command                                        | Description             |
| ---------------------------------------------- | ----------------------- |
| `pnpm --filter @home/db migrate:create <name>` | Create new migration    |
| `pnpm --filter @home/db migrate:up`            | Run pending migrations  |
| `pnpm --filter @home/db migrate:down`          | Rollback last migration |
| `pnpm --filter @home/db db:introspect`         | Generate schema from DB |

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

## Environment Variables

See `.env.example` for the full list with comments. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/home_dev` |
| `DOCUMENT_STORAGE_PATH` | Directory for uploaded documents | `./documents` |
| `AUTH_ENABLED` | Enable Firebase authentication | `false` (single-user mode) |
| `HOME_DOC_PROCESSOR_URL` | Doc processor service URL | `http://localhost:8000` |
| `HOME_API_PORT` | API server port | `3001` (+ branch offset in dev) |
| `HOME_WEB_PORT` | Web server port | `5173` (+ branch offset in dev) |

**Authentication** (only when `AUTH_ENABLED=true`):
- `FIREBASE_SERVICE_ACCOUNT_BASE64` — Base64-encoded service account JSON
- `FIREBASE_CLIENT_API_KEY` — Firebase client API key
- `FIREBASE_CLIENT_APP_ID` — Firebase client app ID

**Notes:**
- **Dev**: PostgreSQL and doc-processor run in Docker on fixed ports (5432, 8000) shared across worktrees. Web and API get branch-specific ports.
- **Self-host**: All services run in Docker. Inter-service communication uses Docker's internal networking (`http://doc-processor:8000`).
- **Railway**: Services are deployed separately. You must set `HOME_DOC_PROCESSOR_URL` to the doc-processor's Railway internal URL.

## Railway Deployment

1. Add a PostgreSQL database from the Railway dashboard
2. Deploy the API and doc-processor as separate services
3. Set `HOME_DOC_PROCESSOR_URL` on the API service to point to your doc-processor's internal URL
4. Configure API keys via the Settings page in the UI

## Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `chore:`
- Keep diffs small and focused
- Never commit `.env` or credentials

## PR Checklist

- [ ] `pnpm check` passes (runs build, typecheck, lint)
- [ ] For UI changes: verified visually
- [ ] Docs updated if adding features

## Common Gotchas

- Run `pnpm build` before `pnpm typecheck` — typecheck depends on built packages
- Restart dev servers after changing shared schemas in `@home/types`
- All worktrees share the same PostgreSQL (port 5432) and doc-processor (port 8000) containers
- Each worktree has its own `.env` (copied when created)

## Debugging

- API logs print to console in dev mode
- Web: React DevTools + Network tab
- Doc Processor: uvicorn logs to console
<!-- TODO: Add more debugging tips -->

## Quick Reference

| Task                   | Location                      |
| ---------------------- | ----------------------------- |
| Add API route          | `apps/api/src/routes/`        |
| Add React component    | `apps/web/src/components/`    |
| Add shared type/schema | `packages/types/src/schemas/` |
| Add database migration | `packages/db/migrations/`     |
| Add database table     | `packages/db/src/schema/`     |

## LLM Operators

Additional rules for AI-assisted contributions:

- Make minimal, targeted diffs
- Only change what's required for the task
- Do not rename/move files unless necessary
- Do not add new build tools or frameworks without direction
- Do not mass-rewrite code for style-only changes
