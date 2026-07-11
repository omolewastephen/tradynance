import "server-only";

import type { Role } from "@tradynance/core";

// Role groupings for admin capabilities. Kept in one place so pages + actions agree.
export const USER_ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];
export const FINANCE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
export const COMPLIANCE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"];
export const ANY_ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "SUPPORT",
  "COMPLIANCE",
  "MODERATOR",
  "DEVELOPER",
  "AUDITOR",
];

// The market-maker system account — hidden from admin user lists.
export const SYSTEM_EMAIL = "market-maker@tradynance.system";
