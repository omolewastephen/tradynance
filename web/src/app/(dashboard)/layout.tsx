import { requireUser } from "@/lib/auth-session";
import { Sidebar } from "@/components/app-shell/sidebar";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Topbar } from "@/components/app-shell/topbar";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE", "COMPLIANCE", "SUPPORT"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  const isAdmin = ADMIN_ROLES.includes(session.user.role as string);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={session.user.email} />
        <MobileNav isAdmin={isAdmin} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
