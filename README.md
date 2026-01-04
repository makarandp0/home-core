# home-core

A self-hosted document management platform. Deploy to your own infrastructure for full control over your data.

## Overview

home-core is built for self-hosters who want to organize and search their important documents without relying on cloud services. Upload your PDFs and images, and the system will extract metadata using AI to make everything searchable.

**Key features:**

- Upload and store important documents (PDFs, images)
- Browse and search your document library
- AI-powered metadata extraction for better searchability
- Bring your own API key (Claude, GPT, or Gemini) — no data leaves your server except for AI processing

You supply your own Anthropic (Claude), OpenAI (GPT), or Google (Gemini) API key. Documents are processed locally, with only the content sent to the AI provider you choose for metadata extraction.

## What's Included

- **Web App** — Vite + React 18 frontend
- **API** — Fastify (TypeScript) backend with vision capabilities
- **Database** — PostgreSQL with Drizzle ORM
- **Doc Processor** — FastAPI (Python) service for PDF/image text extraction

## Quick Start (Docker)

The easiest way to deploy is with Docker Compose:

```bash
# Clone the repo
git clone https://github.com/makarandp0/home-core.git
cd home-core

# Configure environment
cp .env.example .env
```

Edit `.env` with your settings:

| Variable                | Description                              | Default |
| ----------------------- | ---------------------------------------- | ------- |
| `DOCUMENT_STORAGE_PATH` | Directory for storing uploaded documents | `./documents` |
| `AUTH_ENABLED`          | Enable user authentication               | `false` |

**Authentication** is optional. When `AUTH_ENABLED=false` (default), the app runs in single-user mode. To enable Firebase auth, set `AUTH_ENABLED=true` and configure the Firebase variables in `.env` (see `.env.example` for details).

**AI provider keys** (Anthropic, OpenAI, Gemini) are configured via the Settings page in the UI after deployment.

```bash
# Run all services
docker-compose up -d
```

Services start at:

- Web + API: http://localhost:3001
- PostgreSQL: localhost:5432
- Doc Processor: http://localhost:8000

## API Endpoints

- `GET /api/health` — Health check
- `GET /api/user` — User info
- `POST /api/vision` — Vision API (uses configured or user-provided keys)
- `POST /api/documents/process` — Document processing (forwards to doc-processor)

The API serves the web app on all non-`/api` routes.

## Requirements

- ~512MB RAM minimum (more for OCR-heavy workloads)
- Docker 20+ or Node 22 + Python 3.11 + PostgreSQL 16
- Persistent storage for PostgreSQL data

## Updating

```bash
git pull
docker-compose up --build
```

Database migrations run automatically on startup.

## Troubleshooting

| Issue                      | Solution                                                      |
| -------------------------- | ------------------------------------------------------------- |
| Port already in use        | Change port in docker-compose.yml or stop conflicting service |
| Database connection failed | Ensure PostgreSQL is running and `DATABASE_URL` is correct    |
| Doc processor timeout      | Large files may need increased timeout or splitting           |
| AI extraction not working  | Check API key configuration in Settings page                  |

## Contributing

See [AGENTS.md](AGENTS.md) for development setup, build commands, and contribution guidelines.

## License

This project is licensed under the GNU Affero General Public License v3 (AGPLv3).

Self-hosting and modification are encouraged.
Commercial licensing is available for entities that wish to offer the software as a closed service.
