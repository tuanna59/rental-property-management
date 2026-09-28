import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { UtilitiesOverview } from "@/modules/utilities/components/utilities-overview";
import { UtilitiesShell } from "@/modules/utilities/components/utilities-shell";
import { getUtilitiesOverview } from "@/modules/utilities/server/utility.queries";
import { resolveDefaultUtilityBillingMonth } from "@/modules/billing/domain/billing-policy";
import { toDateOnly } from "@/lib/presentation";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function UtilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  if (!params.month) {
    const defaultMonth = toDateOnly(
      resolveDefaultUtilityBillingMonth(new Date()),
    ).slice(0, 7);
    redirect(`/utilities?month=${defaultMonth}`);
  }
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const month = params.month;
  return (
    <UtilitiesShell>
      <UtilitiesOverview
        key={month}
        month={month}
        overview={await getUtilitiesOverview(property.id, `${month}-01`)}
      />
    </UtilitiesShell>
  );
}
