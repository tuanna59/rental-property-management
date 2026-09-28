import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { BillingShell } from "@/modules/billing/components/billing-shell";
import { DepositsDashboard } from "@/modules/billing/components/deposits-dashboard";
import { getDepositOverview } from "@/modules/billing/server/deposit.queries";
export const dynamic = "force-dynamic";
export default async function DepositsPage() {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  return (
    <BillingShell>
      <DepositsDashboard overview={await getDepositOverview(property.id)} />
    </BillingShell>
  );
}
