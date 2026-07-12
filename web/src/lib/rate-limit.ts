import "server-only";
import { headers } from "next/headers";

import { redis } from "@/lib/redis";

// Rate limiting for sensitive server actions (money-out, OTP attempts, order bursts). Backed by
// Redis (a shared sliding-window) when REDIS_URL is set — so limits are enforced consistently
// across multiple web replicas — and falls back to an in-process sliding-window otherwise (correct
// for a single node). The call sites are identical either way.
//
// better-auth's own limiter guards /api/auth/* (see src/lib/auth.ts); it uses the same Redis when
// available. This module covers the custom server actions that don't go through better-auth.

// ── In-process fallback (single node) ──────────────────────────────────────
type Timestamps = number[];
const store = new Map<string, Timestamps>();
let lastSweep = 0;
function maybeSweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  const cutoff = now - Math.max(windowMs, 60_000);
  for (const [k, ts] of store) {
    const kept = ts.filter((t) => t > cutoff);
    if (kept.length === 0) store.delete(k);
    else store.set(k, kept);
  }
}
function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  maybeSweep(now, windowMs);
  const recent = (store.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= limit) {
    store.set(key, recent);
    return { ok: false, remaining: 0, retryAfterMs: recent[0] + windowMs - now };
  }
  recent.push(now);
  store.set(key, recent);
  return { ok: true, remaining: limit - recent.length, retryAfterMs: 0 };
}

// ── Redis sliding-window (shared, atomic via Lua) ──────────────────────────
// One sorted set per key holding request timestamps; each call prunes the window, counts, and
// either rejects (with retry-after) or records the hit + refreshes the TTL — all in one round trip.
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = 0
  if oldest[2] then retry = (tonumber(oldest[2]) + window) - now end
  return {0, 0, retry}
end
redis.call('ZADD', key, now, now .. '-' .. math.random())
redis.call('PEXPIRE', key, window)
return {1, limit - count - 1, 0}
`;

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const [ok, remaining, retryAfterMs] = (await redis!.eval(
      SLIDING_WINDOW_LUA,
      1,
      `rl:${key}`,
      Date.now(),
      windowMs,
      limit,
    )) as [number, number, number];
    return { ok: ok === 1, remaining, retryAfterMs };
  } catch (e) {
    // Redis blip → fail OPEN to a local check rather than locking users out.
    console.error("[rate-limit] redis error, falling back:", (e as Error).message);
    return localRateLimit(key, limit, windowMs);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Record a hit against `key`; deny if more than `limit` hits fall inside the trailing window. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return redis ? redisRateLimit(key, limit, windowMs) : localRateLimit(key, limit, windowMs);
}

/** Best-effort client IP from proxy headers (falls back to a constant so limiting still works). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/** Human-friendly "try again in …" suffix for an error message. */
export function retryAfterText(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.ceil(s / 60)}m`;
}

/** Enforce a limit for `scope` scoped to a user (or IP); returns a ready-made error when exceeded. */
export async function enforceRateLimit(
  scope: string,
  id: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await rateLimit(`${scope}:${id}`, limit, windowMs);
  if (res.ok) return { ok: true };
  return { ok: false, error: `Too many attempts. Try again in ${retryAfterText(res.retryAfterMs)}.` };
}
