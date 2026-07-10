import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AntiPhishingForm } from "./anti-phishing-form";
import { TwoFactorSection } from "./two-factor-section";
import { SessionsSection } from "./sessions-section";

export default async function SecuritySettingsPage() {
  const session = await requireUser();

  const [user, loginHistory] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { antiPhishingCode: true, twoFactorEnabled: true },
    }),
    prisma.loginHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1">Security</h1>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <TwoFactorSection initiallyEnabled={user.twoFactorEnabled ?? false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anti-phishing code</CardTitle>
        </CardHeader>
        <CardContent>
          <AntiPhishingForm initialCode={user.antiPhishingCode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices currently signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsSection currentToken={session.session.token} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login history</CardTitle>
          <CardDescription>Last 10 sign-ins.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {loginHistory.length === 0 && (
              <p className="text-sm text-foreground-muted">No sign-ins recorded yet.</p>
            )}
            {loginHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex justify-between border-b border-border-subtle py-2 text-sm last:border-0"
              >
                <span className="font-mono text-xs text-foreground-muted">
                  {entry.ipAddress ?? "unknown IP"}
                </span>
                <span className="text-xs text-foreground-muted">
                  {entry.createdAt.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
