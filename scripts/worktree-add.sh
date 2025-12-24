#!/usr/bin/env bash
#
# Create a new git worktree for independent parallel work.
#
# Usage:
#   pnpm worktree:add <name>
#
# Example:
#   pnpm worktree:add my-feature
#   # Creates ../my-feature worktree, installs deps
#
# The worktree branches from main. To track with av:
#   cd ../my-feature && av adopt

set -e

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

if [[ -z "$1" ]]; then
  error "Usage: pnpm worktree:add <name>"
fi

NAME="$1"
WORKTREE_PATH="../$NAME"

# Check if worktree already exists
if [[ -d "$WORKTREE_PATH" ]]; then
  error "Directory $WORKTREE_PATH already exists"
fi

# Ensure we have latest main
echo "Fetching latest from origin..."
git fetch origin main:main 2>/dev/null || git fetch origin main || true

# Create worktree with new branch from main
echo "Creating worktree at $WORKTREE_PATH..."
git worktree add -b "$NAME" "$WORKTREE_PATH" main
info "Worktree created"

# Install dependencies
echo "Installing dependencies..."
(cd "$WORKTREE_PATH" && pnpm install)
info "Node dependencies installed"

# Set up Python
echo "Setting up doc-processor (Python)..."
(cd "$WORKTREE_PATH" && pnpm setup:doc-processor)
info "Python dependencies installed"

# Calculate suggested port offset based on existing worktrees
WORKTREE_COUNT=$(git worktree list | wc -l | tr -d ' ')
OFFSET=$((WORKTREE_COUNT * 10))

echo ""
echo -e "${GREEN}Worktree ready!${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  cd $WORKTREE_PATH"
echo "  pnpm dev -- $OFFSET        # Use port offset to avoid conflicts"
echo ""
echo -e "${CYAN}Optional:${NC}"
echo "  av adopt                   # Track branch with av for stacked PRs"
