#!/usr/bin/env bash
#
# Start dev servers with auto-assigned ports based on branch name.
#
# Usage:
#   pnpm dev
#
# Ports are calculated from branch name (deterministic hash).
# Main branch uses default ports, feature branches get unique offsets.
#

set -e

cd "$(dirname "$0")/.."
source scripts/_common.sh

# Pre-flight checks
if [[ ! -d "node_modules" ]]; then
  error "Run pnpm bootstrap first"
fi

# Load .env
load_env || true

# Ensure Docker is running
if ! docker info &> /dev/null; then
  error "Docker is not running"
fi

# Start PostgreSQL if needed
if docker compose ps postgres 2>/dev/null | grep -q "running"; then
  info "PostgreSQL running"
else
  EXISTING_PG=$(docker ps --filter "publish=5432" --format "{{.Names}}" 2>/dev/null)
  if [[ -n "$EXISTING_PG" && "$EXISTING_PG" == *"home-core"*"postgres"* ]]; then
    info "Reusing PostgreSQL ($EXISTING_PG)"
  elif [[ -n "$EXISTING_PG" ]]; then
    error "Port 5432 in use by $EXISTING_PG"
  else
    warn "Starting PostgreSQL..."
    docker compose up postgres -d
    until docker compose exec -T postgres pg_isready -U postgres &> /dev/null; do
      sleep 1
    done
    info "PostgreSQL started"
  fi
fi

# Calculate ports from branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
OFFSET=$(get_port_offset "$BRANCH")
export HOME_WEB_PORT=$((5173 + OFFSET))
export HOME_API_PORT=$((3001 + OFFSET))
export HOME_DOC_PROCESSOR_PORT=$((8000 + OFFSET))

info "Branch '$BRANCH' → offset $OFFSET"
echo ""
echo "  Web:           http://localhost:$HOME_WEB_PORT"
echo "  API:           http://localhost:$HOME_API_PORT"
echo "  Doc Processor: http://localhost:$HOME_DOC_PROCESSOR_PORT"
echo ""

# Set additional env vars
export HOME_DOC_PROCESSOR_URL="http://localhost:$HOME_DOC_PROCESSOR_PORT"
export COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
export VITE_COMMIT_SHA="$COMMIT_SHA"

# Open browser after servers start (background with delay)
WEB_URL="http://localhost:$HOME_WEB_PORT"
(
  sleep 3
  if command -v open &> /dev/null; then
    open "$WEB_URL"  # macOS
  elif command -v xdg-open &> /dev/null; then
    xdg-open "$WEB_URL"  # Linux
  fi
) &

exec pnpm turbo run dev --parallel
