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

# Start doc-processor in Docker (Python deps are complex to install locally)
# Uses fixed port 8000 (shared across worktrees, like PostgreSQL)
if docker compose ps doc-processor 2>/dev/null | grep -q "running"; then
  info "Doc-processor running"
else
  EXISTING_DP=$(docker ps --filter "publish=8000" --format "{{.Names}}" 2>/dev/null)
  if [[ -n "$EXISTING_DP" && "$EXISTING_DP" == *"home-core"*"doc-processor"* ]]; then
    info "Reusing doc-processor ($EXISTING_DP)"
  elif [[ -n "$EXISTING_DP" ]]; then
    error "Port 8000 in use by $EXISTING_DP"
  else
    warn "Building & starting doc-processor..."
    docker compose up doc-processor -d --build
    # Wait for doc-processor to be ready
    for i in {1..30}; do
      if curl -s "http://localhost:8000/health" &> /dev/null; then
        break
      fi
      sleep 1
    done
    info "Doc-processor started"
  fi
fi

# Calculate ports from branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
OFFSET=$(get_port_offset "$BRANCH")
export HOME_WEB_PORT=$((5173 + OFFSET))
export HOME_API_PORT=$((3001 + OFFSET))

info "Branch '$BRANCH' → offset $OFFSET"
echo ""
echo "  Web:           http://localhost:$HOME_WEB_PORT"
echo "  API:           http://localhost:$HOME_API_PORT"
echo "  Doc Processor: http://localhost:8000"
echo ""

# Set additional env vars
export HOME_DOC_PROCESSOR_URL="http://localhost:8000"
export COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
export VITE_COMMIT_SHA="$COMMIT_SHA"

# Open browser after API is ready (background)
WEB_URL="http://localhost:$HOME_WEB_PORT"
API_URL="http://localhost:$HOME_API_PORT"
(
  # Wait for API to be healthy (max 60 seconds)
  for i in {1..60}; do
    if curl -sf "$API_URL/api/health" &> /dev/null; then
      echo -e "\n${GREEN}✓${NC} API ready, opening browser..."
      if command -v open &> /dev/null; then
        open "$WEB_URL"  # macOS
      elif command -v xdg-open &> /dev/null; then
        xdg-open "$WEB_URL"  # Linux
      fi
      exit 0
    fi
    sleep 1
  done
  echo -e "${YELLOW}!${NC} API not ready after 60s, skipping browser open"
) &

# Run dev for all packages except doc-processor (runs in Docker)
exec pnpm turbo run dev --parallel --filter='!@home/doc-processor'
