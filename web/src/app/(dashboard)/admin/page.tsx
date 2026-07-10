import Link from "next/link";

import { requireAdmin } from "@/lib/auth-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>
            Signed in as {session.user.email} ·{" "}
            <span className="font-mono">{session.user.role as string}</span>. The full admin
            panel (users, wallets, KYC, audit logs) is built out in Phase 8.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href="/admin/deposits" className="text-accent hover:underline">
            Deposits — manual credit &amp; pending queue →
          </Link>
          <Link href="/admin/withdrawals" className="text-accent hover:underline">
            Withdrawals — approval queue →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
