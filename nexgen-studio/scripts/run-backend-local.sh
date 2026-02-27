#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"

cd "$BACKEND_DIR"
exec ../venv/bin/uvicorn src.main:app --host "$HOST" --port "$PORT"
