#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Resolve project root (CLAUDE_PROJECT_DIR is set by Claude Code on the web)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Install root dependencies
echo "Installing root dependencies..."
cd "$PROJECT_DIR" && npm install

# Install functions dependencies
echo "Installing functions dependencies..."
cd "$PROJECT_DIR/functions" && npm install
cd "$PROJECT_DIR"

echo "Dependencies installed successfully."
