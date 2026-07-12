// Server-side (Node.js runtime) Sentry init, loaded by instrumentation.ts only on that runtime.
// No-op without SENTRY_DSN. Kept in its own file so the edge/middleware bundle never imports it.
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    environment: process.env.NODE_ENV,
  });
}
