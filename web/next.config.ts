import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @tradynance/core is a workspace package shipped as raw TS source (no build step),
  // so Next.js needs to transpile it like first-party code rather than treating it as a
  // pre-built node_modules package.
  transpilePackages: ["@tradynance/core"],
  webpack: (config) => {
    // The core package uses ESM-correct `.js` extensions in its relative imports (the modern
    // standard, required by Node ESM and used by tsx). Webpack can't resolve `./ledger.js` to
    // the actual `./ledger.ts` source without this mapping.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ...config.resolve.extensionAlias,
    };
    return config;
  },
};

export default nextConfig;
