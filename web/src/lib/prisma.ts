// The Prisma client is generated into packages/core (see generator.output in
// web/prisma/schema.prisma) so services/chain-watcher can share the exact same client and
// money-movement logic (packages/core/src/ledger.ts) — re-exported here so existing `@/lib/
// prisma` imports across the app don't all need to change.
export { prisma } from "@tradynance/core";
