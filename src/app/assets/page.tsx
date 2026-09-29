import { AssetsShell } from "@/modules/assets/components/assets-shell";
import { InventoryDashboard } from "@/modules/assets/components/inventory-dashboard";
import { getAssetInventoryPage } from "@/modules/assets/server/assets.queries";
import { getPrimaryPropertyShell } from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const property = await getPrimaryPropertyShell();
  if (!property) return null;
  const params = await searchParams;
  return (
    <AssetsShell>
      <InventoryDashboard
        propertyId={property.id}
        view={await getAssetInventoryPage(property.id)}
        initialLocation={params.location}
      />
    </AssetsShell>
  );
}
