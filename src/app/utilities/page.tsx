import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { UtilitiesOverview } from "@/modules/utilities/components/utilities-overview";
import { UtilitiesShell } from "@/modules/utilities/components/utilities-shell";
import { getUtilitiesOverview } from "@/modules/utilities/server/utility.queries";
import { resolveDefaultUtilityBillingMonth } from "@/modules/billing/domain/billing-policy";
import { toDateOnly } from "@/lib/presentation";
export const dynamic = "force-dynamic";
export default async function UtilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const month =
    (await searchParams).month ||
    toDateOnly(resolveDefaultUtilityBillingMonth(new Date())).slice(0, 7);
  return (
    <UtilitiesShell property={property}>
      <UtilitiesOverview
        month={month}
        overview={await getUtilitiesOverview(property.id, `${month}-01`)}
      />
    </UtilitiesShell>
  );
}
