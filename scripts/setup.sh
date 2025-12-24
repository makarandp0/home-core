#!/usr/bin/env bash
#
# Bootstrap script for local development.
# Run once after cloning, or anytime to ensure everything is up to date.
#
# Usage:
#   pnpm setup
#
# What it does:
#   1. Checks Node version matches .nvmrc
#   2. Runs pnpm install
#   3. Starts PostgreSQL (via Docker)
#   4. Runs database migrations
#   5. Sets up doc-processor (Python) if --with-python flag is passed
#

set -e

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Parse flags
WITH_PYTHON=false
for arg in "$@"; do
  case $arg in
    --with-python) WITH_PYTHON=true ;;
  esac
done

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

if docker compose ps postgres 2>/dev/null | grep -q "running"; then
  info "PostgreSQL already running"
else
  docker compose up postgres -d
  echo "Waiting for PostgreSQL to be ready..."
  until docker compose exec -T postgres pg_isready -U postgres &> /dev/null; do
    sleep 1
  done
  info "PostgreSQL started"
fi

# 5. Run migrations
echo ""
echo "Running database migrations..."
pnpm --filter @home/db migrate:up
info "Migrations complete"

# 6. Optional: Set up doc-processor
if [[ "$WITH_PYTHON" == "true" ]]; then
  echo ""
  echo "Setting up doc-processor (Python)..."
  pnpm setup:doc-processor
  info "Doc-processor ready"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  pnpm dev          # Start all services"
echo "  pnpm dev -- 10    # Start with port offset (for worktrees)"
if [[ "$WITH_PYTHON" == "false" ]]; then
  echo ""
  echo "To also set up the Python doc-processor:"
  echo "  pnpm setup --with-python"
fi
