# home-core

A self-hosted document management platform. Deploy to your own infrastructure for full control over your data.

## Overview

home-core is built for self-hosters who want to organize and search their important documents without relying on cloud services. Upload your PDFs and images, and the system will extract metadata using AI to make everything searchable.

**Key features:**
- Upload and store important documents (PDFs, images)
- Browse and search your document library
- AI-powered metadata extraction for better searchability
- Bring your own API key (Claude or Gemini) — no data leaves your server except for AI processing

You supply your own Anthropic (Claude) or Google (Gemini) API key. Documents are processed locally, with only the content sent to the AI provider you choose for metadata extraction.

## What's Included

- **Web App** — Vite + React 18 frontend
- **API** — Fastify (TypeScript) backend with vision capabilities
- **Doc Processor** — FastAPI (Python) service for PDF/image text extraction

## Quick Start (Docker)

The easiest way to deploy is with Docker Compose:

```bash
# Clone the repo
git clone https://github.com/your-org/home-core.git
cd home-core

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your API keys

# Run all services
docker-compose up
```

Services start at:
- Web + API: http://localhost:3001
- Doc Processor: http://localhost:8000

## Environment Variables

Create `apps/api/.env` from the example file:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude vision (optional if users provide their own) |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o vision (optional if users provide their own) |
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini vision (optional if users provide their own) |
| `DOC_PROCESSOR_URL` | URL of doc-processor service (default: `http://localhost:8000`) |

Users can override API keys in the UI if not configured server-side.

## Deployment Options

### Docker Compose (Recommended)

```bash
docker-compose up -d
```

Starts both API (serving the web app) and doc-processor services.

### Individual Containers

**API + Web:**
```bash
docker build -f apps/api/Dockerfile -t home-api:local .
docker run --rm -e PORT=3001 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -p 3001:3001 home-api:local
```

**Doc Processor:**
```bash
docker build -t doc-processor:local apps/doc-processor/
docker run --rm -p 8000:8000 doc-processor:local
```

### Railway

For Railway deployments:
```bash
cp railway-vars.example.txt railway-vars.txt
# Edit with your API keys
railway variables set $(cat railway-vars.txt | xargs)
```

## API Endpoints

- `GET /api/health` — Health check
- `GET /api/user` — User info
- `POST /api/vision` — Vision API (uses configured or user-provided keys)
- `POST /api/documents/process` — Document processing (forwards to doc-processor)

The API serves the web app on all non-`/api` routes.

## Requirements

- ~512MB RAM minimum (more for OCR-heavy workloads)
- Docker 20+ or Node 22 + Python 3.11
<!-- TODO: Add CPU/storage recommendations -->

## Updating

```bash
git pull
docker-compose up --build
```
<!-- TODO: Add migration notes if needed -->

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in docker-compose.yml or stop conflicting service |
| API keys not working | Check `apps/api/.env` format, no quotes needed |
| Doc processor timeout | Large files may need increased timeout or splitting |
<!-- TODO: Add more common issues -->

## Contributing

See [AGENTS.md](AGENTS.md) for development setup, build commands, and contribution guidelines.

## License

This project is licensed under the [Elastic License 2.0](LICENSE). You are free to use, modify, and distribute the software, but you may not offer it as a hosted/managed service.
