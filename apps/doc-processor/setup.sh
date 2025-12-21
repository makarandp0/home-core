#!/bin/bash
# Setup script for doc-processor Python service

set -e

# Add uv to PATH if installed via astral.sh
export PATH="$HOME/.local/bin:$PATH"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

echo "uv version: $(uv --version)"

# Navigate to doc-processor directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing Python dependencies..."
uv sync

echo ""
echo "Setup complete! To run the service:"
echo "  cd apps/doc-processor"
echo "  uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "Or from repo root:"
echo "  pnpm dev:doc-processor"
