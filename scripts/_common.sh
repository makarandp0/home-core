#!/usr/bin/env bash
#
# Shared utilities for scripts.
# Source this file, don't execute it directly.
#

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[0;33m'
export CYAN='\033[0;36m'
export NC='\033[0m'

# Logging helpers
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Load environment variables from .env at project root
load_env() {
  local env_file=".env"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    return 0
  fi
  return 1
}

# Calculate port offset from branch name (deterministic hash)
# Returns offset in increments of 10 (0, 10, 20, ... 990)
get_port_offset() {
  local branch="${1:-main}"
  if [[ "$branch" == "main" || "$branch" == "master" ]]; then
    echo "0"
  else
    echo $(( $(echo "$branch" | cksum | cut -d' ' -f1) % 100 * 10 ))
  fi
}

# Calculate ports for a given branch
# Sets: HOME_WEB_PORT, HOME_API_PORT, HOME_DOC_PROCESSOR_PORT
calculate_ports() {
  local branch="${1:-main}"
  local offset
  offset=$(get_port_offset "$branch")

  export HOME_WEB_PORT=$((5173 + offset))
  export HOME_API_PORT=$((3001 + offset))
  export HOME_DOC_PROCESSOR_PORT=$((8000 + offset))

  echo "$offset"
}

# Export functions for use in subshells
export -f info warn error load_env get_port_offset calculate_ports
