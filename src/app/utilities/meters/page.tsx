import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { MonthlyMeterEntry } from "@/modules/utilities/components/monthly-meter-entry";
import { UtilitiesShell } from "@/modules/utilities/components/utilities-shell";
import { getMonthlyMeterEntries } from "@/modules/utilities/server/utility.queries";
export const dynamic = "force-dynamic";
export default async function MetersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const month =
    (await searchParams).month || new Date().toISOString().slice(0, 7);
  return (
    <UtilitiesShell property={property}>
      <MonthlyMeterEntry
        month={month}
        entries={await getMonthlyMeterEntries(property.id, `${month}-01`)}
      />
    </UtilitiesShell>
  );
}
