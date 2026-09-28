import {
  Building2,
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
] as const;

export function isNavigationHrefActive(pathname: string, href: string) {
  if (href === "/" || href === "/utilities") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
