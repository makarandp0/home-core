#!/usr/bin/env bash
#
# Shared utilities for setup scripts.
# Source this file, don't execute it directly.
#

# Colors (exported for subshells)
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[0;33m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# Logging helpers
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Set up .env files from .env.example templates
# Call from repo root directory
setup_env_files() {
  echo ""
  echo "Setting up environment files..."
  for example in packages/db/.env.example apps/api/.env.example; do
    envfile="${example%.example}"
    if [[ -f "$example" && ! -f "$envfile" ]]; then
      cp "$example" "$envfile"
      info "Created $envfile from example"
    fi
  done
}

# Export functions for use in subshells
export -f info warn error setup_env_files
