import { requireAdmin } from "@/lib/auth-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Admin access confirmed</CardTitle>
          <CardDescription>
            You&apos;re signed in as {session.user.email} with role{" "}
            <span className="font-mono">{session.user.role as string}</span>. The full admin
            panel (users, wallets, deposits, KYC, audit logs) is built in Phase 8.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
