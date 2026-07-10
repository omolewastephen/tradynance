import {
  LayoutDashboard,
  Wallet,
  ShieldCheck,
  Landmark,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavSection = { heading?: string; items: NavItem[] };

export const mainSection: NavSection = {
  items: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/settings/security", label: "Security", icon: ShieldCheck },
  ],
};

export const adminSection: NavSection = {
  heading: "Admin",
  items: [
    { href: "/admin", label: "Dashboard", icon: Users },
    { href: "/admin/deposits", label: "Deposits", icon: Landmark },
  ],
};

export function sectionsFor(isAdmin: boolean): NavSection[] {
  return isAdmin ? [mainSection, adminSection] : [mainSection];
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}
