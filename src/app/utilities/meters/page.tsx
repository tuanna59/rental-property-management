import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { MonthlyMeterEntry } from "@/modules/utilities/components/monthly-meter-entry";
import { UtilitiesShell } from "@/modules/utilities/components/utilities-shell";
import { getMonthlyMeterEntries } from "@/modules/utilities/server/utility.queries";
import { resolveDefaultUtilityBillingMonth } from "@/modules/billing/domain/billing-policy";
import { toDateOnly } from "@/lib/presentation";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function MetersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  if (!params.month) {
    const defaultMonth = toDateOnly(
      resolveDefaultUtilityBillingMonth(new Date()),
    ).slice(0, 7);
    redirect(`/utilities/meters?month=${defaultMonth}`);
  }
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const month = params.month;
  return (
    <UtilitiesShell property={property}>
      <MonthlyMeterEntry
        key={month}
        propertyId={property.id}
        month={month}
        entries={await getMonthlyMeterEntries(property.id, `${month}-01`)}
      />
    </UtilitiesShell>
  );
}
