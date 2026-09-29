import { MaintenanceDashboard } from "@/modules/operations/components/maintenance-dashboard";
import { OperationsShell } from "@/modules/operations/components/operations-shell";
import { getMaintenancePage } from "@/modules/operations/server/operations.queries";
import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; search?: string }>;
}) {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  return (
    <OperationsShell>
      <MaintenanceDashboard
        propertyId={property.id}
        view={await getMaintenancePage(property.id)}
        initialSpaceId={(await searchParams).space || "ALL"}
        initialSearch={(await searchParams).search || ""}
      />
    </OperationsShell>
  );
}
