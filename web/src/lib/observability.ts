import "server-only";
import * as Sentry from "@sentry/nextjs";

// The seam app code calls to report problems. Always logs structured output server-side; also
// forwards to Sentry, which is a safe no-op until initialised (i.e. until SENTRY_DSN is set — see
// src/instrumentation.ts). Use it in catch blocks around money-critical or external-IO code so a
// swallowed error still surfaces.
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[observability] exception:", message, context ?? "");
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>,
): void {
  console.log(`[observability] ${level}:`, message, context ?? "");
  Sentry.captureMessage(message, { level, extra: context });
}
