#!/bin/bash
set -euo pipefail

# Only run in Claude Code web (remote) environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== Session Start Hook ==="

# ── npm dependencies ────────────────────────────────────────────────────────
echo "→ Installing frontend dependencies..."
npm install

echo "→ Installing functions dependencies..."
(cd functions && npm install)

# ── Firebase CLI ─────────────────────────────────────────────────────────────
if ! command -v firebase &>/dev/null; then
  echo "→ Installing Firebase CLI..."
  npm install -g firebase-tools
else
  echo "→ Firebase CLI: $(firebase --version)"
fi

# ── GitHub CLI ───────────────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "→ Installing GitHub CLI..."
  GH_VERSION=$(curl -fsSL --connect-timeout 15 \
    https://api.github.com/repos/cli/cli/releases/latest \
    | grep '"tag_name"' | head -1 | sed 's/.*"v\([^"]*\)".*/\1/') \
    || GH_VERSION="2.62.0"
  curl -fsSL \
    "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
    -o /tmp/gh.tar.gz
  tar -xf /tmp/gh.tar.gz -C /tmp/
  mv "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh
  rm -rf /tmp/gh.tar.gz "/tmp/gh_${GH_VERSION}_linux_amd64"
  echo "→ GitHub CLI installed: $(gh --version | head -1)"
else
  echo "→ GitHub CLI: $(gh --version | head -1)"
fi

# ── Credential checks ────────────────────────────────────────────────────────
# gh CLI picks up GITHUB_TOKEN automatically — no extra auth step needed.
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠  GITHUB_TOKEN not set. Add it to Claude Code secrets to enable GitHub operations."
else
  echo "→ GITHUB_TOKEN present — gh CLI is authenticated."
fi

# Firebase CLI picks up FIREBASE_TOKEN automatically for CI auth.
if [ -z "${FIREBASE_TOKEN:-}" ]; then
  echo "⚠  FIREBASE_TOKEN not set. Add it to Claude Code secrets to enable Firebase deployments."
else
  echo "→ FIREBASE_TOKEN present — Firebase CLI is authenticated."
fi

# ── Write .env.local for Vite build ─────────────────────────────────────────
# Firebase web config values are injected via Claude Code secrets (VITE_FIREBASE_*).
# Vite reads them directly from the environment — no .env.local needed in CI.

echo "=== Session start complete ==="
