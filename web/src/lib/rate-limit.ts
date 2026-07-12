import "server-only";
import { headers } from "next/headers";

// App-level rate limiting for sensitive server actions (money-out, OTP attempts, order bursts).
// This is a sliding-window log kept in process memory — correct and dependency-free for the
// current single-node deployment. For horizontal scaling, swap `hit()` for a shared store
// (Redis INCR+EXPIRE / better-auth secondary storage); the call sites don't change.
//
// better-auth's own limiter guards /api/auth/* (see src/lib/auth.ts). This covers the custom
// server actions that don't go through better-auth.

type Timestamps = number[];
const store = new Map<string, Timestamps>();

// Occasional sweep so idle keys don't leak memory (cheap; runs at most once a minute).
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

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Record a hit against `key`; deny if more than `limit` hits fall inside the trailing window. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  maybeSweep(now, windowMs);
  const cutoff = now - windowMs;
  const recent = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    store.set(key, recent);
    return { ok: false, remaining: 0, retryAfterMs: recent[0] + windowMs - now };
  }
  recent.push(now);
  store.set(key, recent);
  return { ok: true, remaining: limit - recent.length, retryAfterMs: 0 };
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

/**
 * Convenience wrapper: enforce a limit for `action` scoped to a user (or IP), returning a
 * ready-made error object when exceeded.
 */
export function enforceRateLimit(
  scope: string,
  id: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; error: string } {
  const res = rateLimit(`${scope}:${id}`, limit, windowMs);
  if (res.ok) return { ok: true };
  return { ok: false, error: `Too many attempts. Try again in ${retryAfterText(res.retryAfterMs)}.` };
}
