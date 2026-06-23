#!/usr/bin/env bash
set -euo pipefail

SANDBOX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WINDMILL_DIR="${WINDMILL_DIR:-$(cd "$SANDBOX_DIR/../windmill" && pwd)}"
BACKEND_URL="${WINDMILL_BACKEND_URL:-http://localhost}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed — install Docker Desktop or set WINDMILL_DIR + use the cargo+npm path" >&2
  exit 1
fi

echo "→ docker compose up -d (from $WINDMILL_DIR)"
( cd "$WINDMILL_DIR" && docker compose up -d )

echo "→ waiting for backend at $BACKEND_URL/api/version ..."
deadline=$(( $(date +%s) + 180 ))
until curl -fsS "$BACKEND_URL/api/version" >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "backend did not become healthy within 180s" >&2
    exit 1
  fi
  sleep 2
done
echo "✓ backend healthy"

echo "→ waiting for frontend at $BACKEND_URL/ ..."
deadline=$(( $(date +%s) + 60 ))
until curl -fsS "$BACKEND_URL/" >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "frontend did not become healthy within 60s" >&2
    exit 1
  fi
  sleep 2
done
echo "✓ frontend healthy"
