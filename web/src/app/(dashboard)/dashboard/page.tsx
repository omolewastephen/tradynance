import { requireUser } from "@/lib/auth-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h1">Welcome back</h1>
        <p className="text-foreground-muted">{session.user.email}</p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Phase 1 — foundation of the account</CardTitle>
          <CardDescription>
            Wallets, markets, and portfolio views land in later phases. This page confirms
            auth, session, and role are working end to end.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <span className="text-foreground-muted">Role</span>
          <span className="font-mono">{session.user.role as string}</span>
          <span className="text-foreground-muted">Status</span>
          <span className="font-mono">{session.user.status as string}</span>
          <span className="text-foreground-muted">KYC status</span>
          <span className="font-mono">{session.user.kycStatus as string}</span>
        </CardContent>
      </Card>
    </div>
  );
}
