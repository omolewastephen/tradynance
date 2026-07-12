"use client";

import dynamic from "next/dynamic";

// Client-side lazy load of the wagmi-powered pay component so the (heavy) web3 stack ships as a
// route-isolated async chunk, never in shared First Load JS, and never runs during SSR.
const PayWithWallet = dynamic(
  () => import("./pay-with-wallet").then((m) => m.PayWithWallet),
  { ssr: false, loading: () => <div className="text-xs text-foreground-muted">Loading wallet…</div> },
);

export function PayWithWalletLoader(props: { depositAddress: string; symbol: string }) {
  return <PayWithWallet {...props} />;
}
