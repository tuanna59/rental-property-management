import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  ReceiptText,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AppNavigationLabelKey =
  | "dashboard"
  | "building"
  | "tenants"
  | "utilities"
  | "utilitiesOverview"
  | "meters"
  | "rates"
  | "billing"
  | "invoices"
  | "payments"
  | "deposits"
  | "operations"
  | "maintenance"
  | "tasks"
  | "expenses"
  | "assets"
  | "inventory"
  | "devices"
  | "reports";

export type AppNavigationChild = {
  id: string;
  labelKey: AppNavigationLabelKey;
  href: string;
};

export type AppNavigationItem = {
  id: string;
  labelKey: AppNavigationLabelKey;
  href?: string;
  icon: LucideIcon;
  children?: readonly AppNavigationChild[];
};

export const appNavigation: readonly AppNavigationItem[] = [
  {
    id: "dashboard",
    labelKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "building",
    labelKey: "building",
    href: "/building",
    icon: Building2,
  },
  {
    id: "tenants",
    labelKey: "tenants",
    href: "/tenants",
    icon: Users,
  },
  {
    id: "utilities",
    labelKey: "utilities",
    icon: Zap,
    children: [
      { id: "utilities-overview", labelKey: "utilitiesOverview", href: "/utilities" },
      { id: "utilities-meters", labelKey: "meters", href: "/utilities/meters" },
      { id: "utilities-rates", labelKey: "rates", href: "/utilities/rates" },
    ],
  },
  {
    id: "billing",
    labelKey: "billing",
    icon: ReceiptText,
    children: [
      { id: "billing-invoices", labelKey: "invoices", href: "/billing/invoices" },
      { id: "billing-payments", labelKey: "payments", href: "/billing/payments" },
      { id: "billing-deposits", labelKey: "deposits", href: "/billing/deposits" },
    ],
  },
  {
    id: "operations",
    labelKey: "operations",
    icon: ClipboardCheck,
    children: [
      { id: "operations-maintenance", labelKey: "maintenance", href: "/operations/maintenance" },
      { id: "operations-tasks", labelKey: "tasks", href: "/operations/tasks" },
      { id: "operations-expenses", labelKey: "expenses", href: "/operations/expenses" },
    ],
  },
  {
    id: "assets",
    labelKey: "assets",
    icon: Boxes,
    children: [
      { id: "assets-inventory", labelKey: "inventory", href: "/assets" },
      { id: "assets-devices", labelKey: "devices", href: "/assets/devices" },
    ],
  },
  {
    id: "reports",
    labelKey: "reports",
    href: "/reports",
    icon: BarChart3,
  },
] as const;

export function isNavigationHrefActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/building" || href === "/utilities" || href === "/reports") return pathname === href;
  if (href === "/assets") {
    return pathname === href || (pathname.startsWith("/assets/") && !pathname.startsWith("/assets/devices"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
