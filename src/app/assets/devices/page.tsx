import { AssetsShell } from "@/modules/assets/components/assets-shell";
import { DevicesDashboard } from "@/modules/assets/components/devices-dashboard";
import { getDevicePage } from "@/modules/assets/server/assets.queries";
import { getPrimaryPropertyShell } from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const property = await getPrimaryPropertyShell();
  if (!property) return null;
  return <AssetsShell><DevicesDashboard propertyId={property.id} view={await getDevicePage(property.id)} /></AssetsShell>;
}
