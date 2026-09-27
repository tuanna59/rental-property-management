import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { BillingShell } from "@/modules/billing/components/billing-shell";
import { PaymentsDashboard } from "@/modules/billing/components/payments-dashboard";
import {
  getFinancialSummary,
  getPayments,
} from "@/modules/billing/server/payment.queries";
export const dynamic = "force-dynamic";
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const month =
    (await searchParams).month || new Date().toISOString().slice(0, 7);
  const [payments, summary] = await Promise.all([
    getPayments(property.id, `${month}-01`),
    getFinancialSummary(property.id, `${month}-01`),
  ]);
  return (
    <BillingShell property={property}>
      <PaymentsDashboard payments={payments} summary={summary} month={month} />
    </BillingShell>
  );
}
