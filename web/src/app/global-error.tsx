"use client";

import { useEffect } from "react";

// Top-level error boundary for the whole app. Reports client crashes to Sentry and shows a minimal
// recovery screen. Must render its own <html>/<body> since it replaces the root layout. Sentry is
// imported LAZILY (only when this boundary actually renders) so the monitoring SDK never lands in
// every page's First Load JS — it loads as a separate chunk on the rare crash path, and is gated
// on a public DSN so it stays inert when monitoring is off.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          background: "#08090C",
          color: "#e6e9ef",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#8a93a6", fontSize: 14, marginBottom: 20 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#18C964",
              color: "#04120a",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
