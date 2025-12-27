#!/usr/bin/env bash
#
# Load environment variables and run a command.
# Usage: with-env.sh <command> [args...]
#

set -e

# Save original directory
ORIGINAL_DIR="$(pwd)"

# Go to project root to load env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
source scripts/_common.sh

# Load environment variables from .env
load_env

# Calculate and export ports based on current git branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
calculate_ports "$BRANCH" > /dev/null

# Return to original directory and run the command
cd "$ORIGINAL_DIR"
exec "$@"
