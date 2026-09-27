import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { BillingShell } from "@/modules/billing/components/billing-shell";
import { InvoiceDashboard } from "@/modules/billing/components/invoice-dashboard";
import {
  getBillingCandidates,
  getInvoices,
} from "@/modules/billing/server/billing.queries";
export const dynamic = "force-dynamic";
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const month =
    (await searchParams).month || new Date().toISOString().slice(0, 7);
  const [candidates, invoices] = await Promise.all([
    getBillingCandidates(property.id, `${month}-01`),
    getInvoices(property.id, `${month}-01`),
  ]);
  return (
    <BillingShell property={property}>
      <InvoiceDashboard
        propertyId={property.id}
        month={month}
        candidates={candidates}
        invoices={invoices}
      />
    </BillingShell>
  );
}
