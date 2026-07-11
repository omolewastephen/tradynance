import { redirect } from "next/navigation";

// /futures → default to the flagship perpetual.
export default function FuturesIndex() {
  redirect("/futures/BTCUSDT");
}
