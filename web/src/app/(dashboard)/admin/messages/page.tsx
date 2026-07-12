import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { MessageItem, type MessageVM } from "./message-item";

export const metadata: Metadata = { title: "Messages — Admin" };

export default async function MessagesPage() {
  await requireRole(CONTENT_ROLES);

  const [messages, unread] = await Promise.all([
    prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);

  const vms: MessageVM[] = messages.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-rise flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Messages</h1>
        <p className="text-sm text-foreground-muted">
          Contact form submissions{unread > 0 ? ` · ${unread} new` : ""}
        </p>
      </div>
      <Card className="p-0">
        {vms.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-foreground-muted">No messages yet.</p>
        ) : (
          vms.map((m) => <MessageItem key={m.id} m={m} />)
        )}
      </Card>
    </div>
  );
}
