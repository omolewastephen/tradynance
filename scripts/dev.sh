#!/usr/bin/env bash
# One-command dev launcher: ensures Postgres is up, then starts the web app + market-data +
# market-maker together with prefixed, colored logs. Ctrl-C stops all three.
#
#   npm run dev        (from the repo root)
#
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="/usr/local/opt/postgresql@16/bin"
[ -d "/opt/homebrew/opt/postgresql@16/bin" ] && PG_BIN="/opt/homebrew/opt/postgresql@16/bin"

# 1. Postgres — start it if it isn't already accepting connections.
if ! "$PG_BIN/pg_isready" -q 2>/dev/null; then
  echo "› starting postgresql@16…"
  brew services start postgresql@16 >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    "$PG_BIN/pg_isready" -q 2>/dev/null && break
    sleep 1
  done
fi
if "$PG_BIN/pg_isready" -q 2>/dev/null; then
  echo "✓ postgres ready"
else
  echo "✗ postgres not reachable — start it manually (brew services start postgresql@16)" >&2
  exit 1
fi

# 2. web app + services (Ctrl-C kills the whole group via -k).
exec npm run dev:app
