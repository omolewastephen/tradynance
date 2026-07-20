// The Prisma Next.js monorepo workaround plugin ships no type declarations, and Next.js
// typechecks next.config.ts during the build. Minimal ambient declaration so the import types.
declare module "@prisma/nextjs-monorepo-workaround-plugin" {
  import type { WebpackPluginInstance } from "webpack";
  export class PrismaPlugin implements WebpackPluginInstance {
    constructor();
    apply(compiler: unknown): void;
  }
}
