import { cn } from "@/lib/utils";

// Coins we have a real color SVG for (copied into public/coins from cryptocurrency-icons).
// Anything else falls back to the generic coin glyph.
const HAS_ICON = new Set([
  "BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "XRP", "DOGE",
  "TRX", "LTC", "ADA", "MATIC", "AVAX", "BCH", "LINK",
]);

export function CoinIcon({
  symbol,
  className,
  size = 32,
}: {
  symbol: string;
  className?: string;
  size?: number;
}) {
  const s = symbol.toUpperCase();
  const file = HAS_ICON.has(s) ? s.toLowerCase() : "generic";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static local SVG, not an optimizable remote image
    <img
      src={`/coins/${file}.svg`}
      alt={`${s} icon`}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full", className)}
    />
  );
}
