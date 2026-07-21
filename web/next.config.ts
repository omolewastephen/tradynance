import path from "node:path";
import type { NextConfig } from "next";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

// Production security headers applied to every response. The CSP is tuned to work with Next's App
// Router (which injects inline bootstrap scripts/styles) while still locking down framing, object
// embedding, and base-uri. `connect-src` allows the external services the app talks to (Sepolia
// RPC, market-data mirror, Resend, Sentry, WalletConnect wss). A nonce-based strict-dynamic CSP
// (dropping 'unsafe-inline'/'unsafe-eval') is a follow-up hardening step.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Only meaningful over HTTPS (harmless otherwise); enable once served behind TLS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Lean, self-contained production output for Docker/PM2/Render/Railway (a minimal Node server +
  // traced deps only). Netlify's Next runtime does its own function bundling and doesn't use
  // `standalone`, so disable it there (Netlify sets NETLIFY=true during the build).
  output: process.env.NETLIFY ? undefined : "standalone",
  // Trace from the monorepo root so hoisted workspace deps + the generated Prisma client under
  // packages/core are included in the standalone bundle.
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  // Force Prisma's native query engine (.node binary) into every server bundle. Netlify's bundler
  // doesn't detect it on its own → "Query Engine could not be located for rhel-openssl-3.0.x" at
  // runtime (db:down). Belt-and-suspenders with the PrismaPlugin in webpack() below.
  // KYC document uploads post files through a server action; the default 1MB cap would reject a
  // normal phone photo of an ID. Keep in sync with MAX_DOC_BYTES in src/lib/kyc-storage.ts.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },

  outputFileTracingIncludes: {
    "**": ["../packages/core/generated/prisma/**/*.node"],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // @tradynance/core is a workspace package shipped as raw TS source (no build step),
  // so Next.js needs to transpile it like first-party code rather than treating it as a
  // pre-built node_modules package.
  transpilePackages: ["@tradynance/core"],
  webpack: (config, { isServer }) => {
    // The core package uses ESM-correct `.js` extensions in its relative imports (the modern
    // standard, required by Node ESM and used by tsx). Webpack can't resolve `./ledger.js` to
    // the actual `./ledger.ts` source without this mapping.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ...config.resolve.extensionAlias,
    };
    // Copy Prisma's query engine next to the server bundle (the monorepo/Next.js "engine not
    // found" fix). Server build only.
    if (isServer) {
      config.plugins = config.plugins ?? [];
      config.plugins.push(new PrismaPlugin());
    }
    return config;
  },
};

export default nextConfig;
