"use server";

import { revalidatePath } from "next/cache";

import {
  placeOrder,
  cancelOrder,
  notify,
  type PlaceOrderResult,
  type PrismaClient,
} from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export type SubmitOrderInput = {
  marketSymbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  timeInForce: "GTC" | "IOC" | "FOK";
  price?: string;
  quantity: string;
};

export async function submitOrder(input: SubmitOrderInput): Promise<PlaceOrderResult> {
  const session = await requireUser();
  const result = await placeOrder(prisma as PrismaClient, {
    userId: session.user.id,
    marketSymbol: input.marketSymbol,
    side: input.side,
    type: input.type,
    timeInForce: input.type === "MARKET" ? "IOC" : input.timeInForce,
    price: input.price,
    quantity: input.quantity,
  });
  if (result.ok) {
    // Notify on a completed fill (post-tx: a failed notification must not undo the trade).
    if (result.status === "FILLED") {
      await notify(prisma as PrismaClient, {
        userId: session.user.id,
        type: "TRADE",
        title: "Order filled",
        body: `${input.side} ${result.filledQty} ${input.marketSymbol}${
          result.avgPrice ? ` @ ${Number(result.avgPrice).toFixed(2)}` : ""
        } filled.`,
        referenceType: "Order",
        referenceId: result.orderId,
      });
    }
    revalidatePath(`/trade/${input.marketSymbol}`);
    revalidatePath("/wallet");
  }
  return result;
}

export async function cancelUserOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireUser();
  const result = await cancelOrder(prisma as PrismaClient, {
    orderId,
    userId: session.user.id,
  });
  if (result.ok) revalidatePath("/trade", "layout");
  return result;
}
