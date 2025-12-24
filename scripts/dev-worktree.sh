#!/usr/bin/env bash
#
# Run dev servers with port offset for multi-worktree support.
#
# Usage:
#   pnpm dev [-- OFFSET]
#
# Examples:
#   pnpm dev            # Use default ports (offset 0)
#   pnpm dev -- 10      # Web: 5183, API: 3011, Doc: 8010
#   pnpm dev -- 20      # Web: 5193, API: 3021, Doc: 8020
#
# Base ports:
#   Web (Vite):      5173
#   API (Fastify):   3001
#   Doc Processor:   8000

set -e

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Pre-flight checks
if [[ ! -d "node_modules" ]]; then
  error "node_modules not found. Run: pnpm bootstrap"
fi

# Ensure Docker is running
if ! docker info &> /dev/null; then
  error "Docker is not running. Please start Docker and try again."
fi

# Auto-start PostgreSQL if not running
if docker compose ps postgres 2>/dev/null | grep -q "running"; then
  info "PostgreSQL running"
else
  # Check if another home-core postgres is running on port 5432
  EXISTING_PG=$(docker ps --filter "publish=5432" --format "{{.Names}}" 2>/dev/null)
  if [[ -n "$EXISTING_PG" ]]; then
    if [[ "$EXISTING_PG" == *"home-core"*"postgres"* ]]; then
      if docker exec "$EXISTING_PG" pg_isready -U postgres -d home_dev &> /dev/null; then
        info "Reusing existing home-core PostgreSQL ($EXISTING_PG)"
      else
        error "Found home-core postgres ($EXISTING_PG) but cannot connect."
      fi
    else
      error "Port 5432 is in use by a different postgres ($EXISTING_PG). Stop it and try again."
    fi
  else
    warn "PostgreSQL not running, starting..."
    docker compose up postgres -d
    echo "Waiting for PostgreSQL..."
    until docker compose exec -T postgres pg_isready -U postgres &> /dev/null; do
      sleep 1
    done
    info "PostgreSQL started"
  fi
fi

OFFSET="${1:-0}"

# Calculate ports
WEB_PORT=$((5173 + OFFSET))
API_PORT=$((3001 + OFFSET))
DOC_PORT=$((8000 + OFFSET))

echo ""
echo "Starting dev servers with port offset: $OFFSET"
echo "  Web:           http://localhost:$WEB_PORT"
echo "  API:           http://localhost:$API_PORT"
echo "  Doc Processor: http://localhost:$DOC_PORT"
echo ""

# Export environment variables
export VITE_PORT="$WEB_PORT"
export VITE_API_PORT="$API_PORT"
export PORT="$API_PORT"
export DOC_PROCESSOR_PORT="$DOC_PORT"
export DOC_PROCESSOR_URL="http://localhost:$DOC_PORT"
export COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
export VITE_COMMIT_SHA="$COMMIT_SHA"

exec pnpm turbo run dev --parallel
