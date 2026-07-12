import "server-only";
import Redis from "ioredis";

// One shared ioredis connection, created lazily only when REDIS_URL is set. Cached on globalThis so
// hot-reload in dev doesn't leak connections. When REDIS_URL is unset, `redis` is null and callers
// fall back to their in-process behaviour — so nothing here is required for a single-node deploy.
const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function create(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    // Don't crash the process on a transient Redis outage — degrade instead.
    enableOfflineQueue: true,
  });
  client.on("error", (e) => console.error("[redis] connection error:", e.message));
  return client;
}

export const redis: Redis | null = globalForRedis.redis ?? create();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
