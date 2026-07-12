#!/usr/bin/env bash
# Production build for a non-Docker (bare Node / PM2 / systemd) deploy.
# Builds the Next.js standalone output and copies the static + public assets into it (Next doesn't
# do this automatically), so the server is runnable with:
#   node web/.next/standalone/web/server.js
#
#   npm run build   (from the repo root)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "› building web (standalone)…"
npm run build --workspace web

STANDALONE="web/.next/standalone/web"
echo "› copying static + public into the standalone bundle…"
mkdir -p "$STANDALONE/.next"
rm -rf "$STANDALONE/.next/static"
cp -r web/.next/static "$STANDALONE/.next/static"
[ -d web/public ] && { rm -rf "$STANDALONE/public"; cp -r web/public "$STANDALONE/public"; }

echo "✓ standalone server ready: node $STANDALONE/server.js"
