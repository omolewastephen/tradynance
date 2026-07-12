// Next.js server instrumentation. Monitoring is initialised ONLY on the Node.js runtime — the
// edge/middleware runtime intentionally gets no Sentry, so middleware stays lean. The positive
// `NEXT_RUNTIME === "nodejs"` guard is a build-time constant per bundle, so for the edge bundle the
// whole block (and its imports) is dead-code-eliminated. Everything is also gated on SENTRY_DSN, so
// it's fully inert until you point it at a real DSN in production. See docs + .env.example.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Report errors thrown while handling a request (route handlers, RSC, server actions).
export async function onRequestError(
  ...args: Parameters<
    NonNullable<Awaited<typeof import("@sentry/nextjs")>["captureRequestError"]>
  >
) {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
}
