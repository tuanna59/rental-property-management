import { notFound } from "next/navigation";
import { BillingShell } from "@/modules/billing/components/billing-shell";
import { InvoiceDetail } from "@/modules/billing/components/invoice-detail";
import {
  getInvoice,
  getInvoiceMonthNavigation,
} from "@/modules/billing/server/billing.queries";
import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: PageProps<"/billing/invoices/[invoiceId]">) {
  const [{ invoiceId }, property] = await Promise.all([
    params,
    getPrimaryPropertyDashboard(),
  ]);
  if (!property) return null;
  const invoice = await getInvoice(invoiceId);
  if (!invoice) notFound();

  const monthInvoices = await getInvoiceMonthNavigation(
    property.id,
    invoice.billingPeriod,
    invoice.id,
  );

  return (
    <BillingShell>
      <InvoiceDetail invoice={invoice} monthInvoices={monthInvoices} />
    </BillingShell>
  );
}
