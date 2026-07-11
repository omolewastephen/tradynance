import {
  LayoutDashboard,
  PieChart,
  Wallet,
  ArrowUpFromLine,
  ArrowDownUp,
  CandlestickChart,
  ArrowLeftRight,
  ShieldCheck,
  ShieldQuestion,
  ScrollText,
  Landmark,
  Banknote,
  LayoutGrid,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavSection = { heading?: string; items: NavItem[] };

export const mainSection: NavSection = {
  items: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/portfolio", label: "Portfolio", icon: PieChart },
    { href: "/markets", label: "Markets", icon: CandlestickChart },
    { href: "/trade", label: "Trade", icon: ArrowLeftRight },
    { href: "/convert", label: "Convert", icon: ArrowDownUp },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
    { href: "/settings/security", label: "Security", icon: ShieldCheck },
  ],
};

export const adminSection: NavSection = {
  heading: "Admin",
  items: [
    { href: "/admin", label: "Dashboard", icon: LayoutGrid },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/kyc", label: "KYC review", icon: ShieldQuestion },
    { href: "/admin/deposits", label: "Deposits", icon: Landmark },
    { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  ],
};

export function sectionsFor(isAdmin: boolean): NavSection[] {
  return isAdmin ? [mainSection, adminSection] : [mainSection];
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}
