// Chain (viem/on-chain) entry point. Kept OUT of the main package barrel (../index.ts) so that
// pages importing @tradynance/core don't pull viem → ox into their bundle (which emits webpack's
// "Critical dependency: the request of a dependency is an expression" and bloats/breaks routes
// like /futures that only need pure core exports). The one consumer — the admin withdrawal
// broadcast — imports from "@tradynance/core/chain".
export * from "./broadcast.js";
export * from "./evm-withdraw.js";
