// In-app notifications. A thin write helper the money functions (in-transaction) and the
// app/service layers (post-transaction) call to record a user-facing event. Notifications are
// NOT money — a failed insert must never roll back a balance change, so only call notify()
// inside a money transaction when you explicitly want it tied to that commit (e.g. a deposit
// credit or a liquidation, where there's no other natural chokepoint); otherwise emit it from
// the calling action/service after the transaction has committed.

import type { Prisma, PrismaClient, NotificationType } from "../generated/prisma/index.js";

// Accepts either the base client or an interactive-transaction client.
type Client = PrismaClient | Prisma.TransactionClient;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
}

export async function notify(client: Client, input: NotifyInput) {
  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
  });
}
