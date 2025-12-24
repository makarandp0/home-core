#!/usr/bin/env bash
#
# Bootstrap script for local development.
# Run once after cloning, or anytime to ensure everything is up to date.
#
# Usage:
#   pnpm bootstrap
#
# What it does:
#   1. Checks Node version matches .nvmrc
#   2. Runs pnpm install
#   3. Starts PostgreSQL (via Docker)
#   4. Runs database migrations
#   5. Sets up doc-processor (Python)
#   6. Builds all packages (required for dev)
#

set -e

cd "$(dirname "$0")/.."
source scripts/_common.sh

echo "Setting up home-core development environment..."
echo ""

# 1. Check Node version
REQUIRED_NODE=$(cat .nvmrc | tr -d '[:space:]' | sed 's/^v//')
CURRENT_NODE=$(node --version 2>/dev/null | sed 's/^v//' || echo "none")

if [[ "$CURRENT_NODE" != "$REQUIRED_NODE" ]]; then
  error "Node $REQUIRED_NODE required, but found $CURRENT_NODE. Run: nvm use"
fi
info "Node $CURRENT_NODE"

# 2. Check pnpm is available (corepack)
if ! command -v pnpm &> /dev/null; then
  warn "pnpm not found, enabling corepack..."
  corepack enable
fi
info "pnpm $(pnpm --version)"

# 3. Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install
info "Dependencies installed"

# 4. Start PostgreSQL
echo ""
echo "Starting PostgreSQL..."
if ! docker info &> /dev/null; then
  error "Docker is not running. Please start Docker and try again."
fi

# Check if this project's postgres is already running
if docker compose ps postgres 2>/dev/null | grep -q "running"; then
  info "PostgreSQL already running"
else
  # Check if another home-core postgres is running on port 5432
  EXISTING_PG=$(docker ps --filter "publish=5432" --format "{{.Names}}" 2>/dev/null)
  if [[ -n "$EXISTING_PG" ]]; then
    # Check if it's a home-core postgres (container name pattern or database check)
    if [[ "$EXISTING_PG" == *"home-core"*"postgres"* ]]; then
      # Verify the database is accessible with our credentials (use docker exec since psql may not be installed locally)
      if docker exec "$EXISTING_PG" pg_isready -U postgres -d home_dev &> /dev/null; then
        info "Reusing existing home-core PostgreSQL from another directory ($EXISTING_PG)"
      else
        error "Found home-core postgres ($EXISTING_PG) but cannot connect. Check credentials."
      fi
    else
      error "Port 5432 is in use by a different postgres ($EXISTING_PG). Stop it and try again."
    fi
  else
    docker compose up postgres -d
    echo "Waiting for PostgreSQL to be ready..."
    until docker compose exec -T postgres pg_isready -U postgres &> /dev/null; do
      sleep 1
    done
    info "PostgreSQL started"
  fi
fi

# 5. Set up .env files from examples if they don't exist
setup_env_files

# 6. Run migrations
echo ""
echo "Running database migrations..."
pnpm --filter @home/db migrate:up
info "Migrations complete"

# 7. Set up doc-processor (Python)
echo ""
echo "Setting up doc-processor (Python)..."
pnpm setup:doc-processor
info "Doc-processor ready"

# 8. Build all packages (required for dev)
echo ""
echo "Building packages..."
pnpm build
info "Build complete"

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  pnpm dev          # Start all services"
echo "  pnpm dev -- 10    # Start with port offset (for worktrees)"
