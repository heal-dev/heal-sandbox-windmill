#!/usr/bin/env bash
set -euo pipefail

SANDBOX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WINDMILL_DIR="${WINDMILL_DIR:-$(cd "$SANDBOX_DIR/../windmill" && pwd)}"

WIPE=""
if [ "${1:-}" = "--wipe" ]; then
  WIPE="--volumes"
fi

( cd "$WINDMILL_DIR" && docker compose down $WIPE )
