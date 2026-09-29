import { OperationsShell } from "@/modules/operations/components/operations-shell";
import { TasksDashboard } from "@/modules/operations/components/tasks-dashboard";
import { getTaskPage } from "@/modules/operations/server/operations.queries";
import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  return (
    <OperationsShell>
      <TasksDashboard propertyId={property.id} view={await getTaskPage(property.id)} />
    </OperationsShell>
  );
}
