#!/usr/bin/env bash
#
# Bootstrap script for local development.
# Run once after cloning, or anytime to ensure everything is up to date.
#
# Usage:
#   pnpm bootstrap
#

set -e

cd "$(dirname "$0")/.."
source scripts/_common.sh

echo "Setting up home-core..."
echo ""

# 1. Check Node version
REQUIRED_NODE=$(cat .nvmrc | tr -d '[:space:]' | sed 's/^v//')
CURRENT_NODE=$(node --version 2>/dev/null | sed 's/^v//' || echo "none")

if [[ "$CURRENT_NODE" != "$REQUIRED_NODE" ]]; then
  error "Node $REQUIRED_NODE required, but found $CURRENT_NODE. Run: nvm use"
fi
info "Node $CURRENT_NODE"

# 2. Check pnpm
if ! command -v pnpm &> /dev/null; then
  warn "pnpm not found, enabling corepack..."
  corepack enable
fi
info "pnpm $(pnpm --version)"

# 3. Install dependencies
echo ""
pnpm install
info "Dependencies installed"

# 4. Start PostgreSQL
echo ""
if ! docker info &> /dev/null; then
  error "Docker is not running. Please start Docker and try again."
fi

if docker compose ps postgres 2>/dev/null | grep -q "running"; then
  info "PostgreSQL running"
else
  EXISTING_PG=$(docker ps --filter "publish=5432" --format "{{.Names}}" 2>/dev/null)
  if [[ -n "$EXISTING_PG" && "$EXISTING_PG" == *"home-core"*"postgres"* ]]; then
    info "Reusing existing PostgreSQL ($EXISTING_PG)"
  elif [[ -n "$EXISTING_PG" ]]; then
    error "Port 5432 in use by $EXISTING_PG. Stop it first."
  else
    docker compose up postgres -d
    echo "Waiting for PostgreSQL..."
    until docker compose exec -T postgres pg_isready -U postgres &> /dev/null; do
      sleep 1
    done
    info "PostgreSQL started"
  fi
fi

# 5. Set up .env
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp ".env.example" ".env"
    info "Created .env from example"
    echo -e "${YELLOW}Edit .env to add your API keys${NC}"
  fi
else
  info ".env exists"
fi

# Load .env for migrations
load_env

# 6. Run migrations
echo ""
pnpm --filter @home/db migrate:up
info "Migrations complete"

# 7. Set up doc-processor
echo ""
pnpm setup:doc-processor
info "Doc-processor ready"

# 8. Build packages
echo ""
pnpm build
info "Build complete"

echo ""
echo -e "${GREEN}Ready!${NC} Run: pnpm dev"
