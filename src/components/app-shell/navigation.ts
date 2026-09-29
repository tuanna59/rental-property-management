import {
  Boxes,
  Building2,
  ClipboardCheck,
  ReceiptText,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AppNavigationChild = {
  label: string;
  href: string;
};

export type AppNavigationItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: readonly AppNavigationChild[];
};

export const appNavigation: readonly AppNavigationItem[] = [
  {
    label: "Building",
    href: "/",
    icon: Building2,
  },
  {
    label: "Tenants",
    href: "/tenants",
    icon: Users,
  },
  {
    label: "Utilities",
    icon: Zap,
    children: [
      { label: "Overview", href: "/utilities" },
      { label: "Meters", href: "/utilities/meters" },
      { label: "Rates", href: "/utilities/rates" },
    ],
  },
  {
    label: "Billing",
    icon: ReceiptText,
    children: [
      { label: "Invoices", href: "/billing/invoices" },
      { label: "Payments", href: "/billing/payments" },
      { label: "Deposits", href: "/billing/deposits" },
    ],
  },
  {
    label: "Operations",
    icon: ClipboardCheck,
    children: [
      { label: "Maintenance", href: "/operations/maintenance" },
      { label: "Tasks", href: "/operations/tasks" },
      { label: "Expenses", href: "/operations/expenses" },
    ],
  },
  {
    label: "Assets",
    icon: Boxes,
    children: [
      { label: "Inventory", href: "/assets" },
      { label: "Devices", href: "/assets/devices" },
    ],
  },
] as const;

export function isNavigationHrefActive(pathname: string, href: string) {
  if (href === "/" || href === "/utilities") return pathname === href;
  if (href === "/assets") {
    return pathname === href || (pathname.startsWith("/assets/") && !pathname.startsWith("/assets/devices"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
