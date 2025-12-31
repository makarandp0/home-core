#!/usr/bin/env bash
#
# Create a new git worktree for parallel development.
#
# Usage:
#   pnpm worktree:add <name>
#
# Example:
#   pnpm worktree:add my-feature
#   cd ../my-feature && pnpm dev
#

set -e

cd "$(dirname "$0")/.."
source scripts/_common.sh

if [[ -z "$1" ]]; then
  error "Usage: pnpm worktree:add <name>"
fi

NAME="$1"
WORKTREE_PATH="../$NAME"

if [[ -d "$WORKTREE_PATH" ]]; then
  error "Directory $WORKTREE_PATH already exists"
fi

# Fetch and create worktree
echo "Fetching latest from origin..."
git fetch origin main:main 2>/dev/null || git fetch origin main || true

echo "Creating worktree..."
git worktree add -b "$NAME" "$WORKTREE_PATH" main
info "Worktree created at $WORKTREE_PATH"

# copy over .claude/settings.worktree.json as .claude/settings.local.json
mkdir -p "$WORKTREE_PATH/.claude"
cp ".claude/settings.worktree.json" "$WORKTREE_PATH/.claude/settings.local.json"
info "Copied .claude/settings.worktree.json to .claude/settings.local.json"

# Install dependencies
echo ""
(cd "$WORKTREE_PATH" && pnpm install)
info "Dependencies installed"

# Copy .env
if [[ -f ".env" ]]; then
  cp ".env" "$WORKTREE_PATH/.env"
  info "Copied .env"
fi

# Build
(cd "$WORKTREE_PATH" && pnpm build)
info "Build complete"


# Show assigned ports
OFFSET=$(get_port_offset "$NAME")
info "Ports: web:$((5173 + OFFSET)) api:$((3001 + OFFSET)) doc:$((8000 + OFFSET))"

echo ""
echo -e "${GREEN}Ready!${NC}"
echo "  cd $WORKTREE_PATH"
echo "  pnpm dev"
