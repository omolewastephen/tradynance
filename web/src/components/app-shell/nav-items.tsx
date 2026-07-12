import {
  LayoutDashboard,
  PieChart,
  Wallet,
  ArrowUpFromLine,
  ArrowDownUp,
  CandlestickChart,
  ArrowLeftRight,
  Gauge,
  Gift,
  Crown,
  Coins,
  Rocket,
  Image as ImageIcon,
  ShieldCheck,
  ShieldQuestion,
  ScrollText,
  Landmark,
  Banknote,
  LayoutGrid,
  Users,
  Newspaper,
  Inbox,
  FileText,
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
    { href: "/futures", label: "Futures", icon: Gauge },
    { href: "/convert", label: "Convert", icon: ArrowDownUp },
    { href: "/staking", label: "Staking", icon: Coins },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
    { href: "/referrals", label: "Referrals", icon: Gift },
    { href: "/launchpad", label: "Launchpad", icon: Rocket },
    { href: "/nft", label: "NFT", icon: ImageIcon },
    { href: "/vip", label: "VIP", icon: Crown },
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
    { href: "/admin/blog", label: "Blog", icon: Newspaper },
    { href: "/admin/content", label: "Site content", icon: FileText },
    { href: "/admin/messages", label: "Messages", icon: Inbox },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  ],
};

export function sectionsFor(isAdmin: boolean): NavSection[] {
  return isAdmin ? [mainSection, adminSection] : [mainSection];
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}
