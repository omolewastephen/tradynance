import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountSuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account access restricted</CardTitle>
          <CardDescription>
            Your account is suspended or frozen. Contact support if you believe this is a
            mistake.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
