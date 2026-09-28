import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { UtilityRates } from "@/modules/utilities/components/utility-rates";
import { UtilitiesShell } from "@/modules/utilities/components/utilities-shell";
import { getRates } from "@/modules/utilities/server/utility.queries";
export const dynamic = "force-dynamic";
export default async function RatesPage() {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const rooms = property.floors
    .flatMap((floor) => floor.spaces)
    .filter((space) => space.type === "ROOM")
    .map((space) => ({ id: space.id, name: space.name }));
  return (
    <UtilitiesShell>
      <UtilityRates
        propertyId={property.id}
        rooms={rooms}
        data={await getRates(property.id)}
      />
    </UtilitiesShell>
  );
}
