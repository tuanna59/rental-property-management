import { DashboardView } from "@/modules/analytics/components/dashboard";
import { getDashboardProjection } from "@/modules/analytics/server/analytics.queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const view = await getDashboardProjection();
  if (!view) return null;
  return <DashboardView view={view} />;
}
