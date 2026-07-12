# Tradynance — single multi-stage Dockerfile producing two runtime targets:
#   • target "web"      — lean Next.js standalone server (node web/server.js)
#   • target "services" — full workspace image that runs any standalone service via tsx
# docker-compose builds both from this file. See docs/DEPLOY.md.

# ── base: install the whole npm-workspace (incl. dev deps: tsx + prisma CLI) + generate client ──
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better layer caching, then install once.
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY packages/core/package.json packages/core/package.json
COPY services/chain-watcher/package.json services/chain-watcher/package.json
COPY services/market-data/package.json services/market-data/package.json
COPY services/market-maker/package.json services/market-maker/package.json
COPY services/liquidation-engine/package.json services/liquidation-engine/package.json
COPY services/sweeper/package.json services/sweeper/package.json
RUN npm ci

COPY . .
RUN npx prisma generate --schema web/prisma/schema.prisma

# ── builder: produce the Next standalone output ──
FROM base AS builder
RUN npm run build --workspace web

# ── web: minimal standalone runner (no source, no dev deps) ──
FROM node:20-slim AS web
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Standalone bundles a minimal server + traced node_modules; static/public are copied separately.
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "web/server.js"]

# ── services: full image (source + node_modules + tsx). command is set per-service in compose. ──
FROM base AS services
ENV NODE_ENV=production
CMD ["node", "-e", "console.error('set a service command, e.g. npx tsx services/sweeper/src/index.ts'); process.exit(1)"]
