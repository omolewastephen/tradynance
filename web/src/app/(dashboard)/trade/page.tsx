import { redirect } from "next/navigation";

// /trade → default to the most-liquid pair.
export default function TradeIndex() {
  redirect("/trade/BTCUSDT");
}
