import { ReportsView } from "@/modules/analytics/components/reports";
import { getReportsProjection } from "@/modules/analytics/server/analytics.queries";

export const dynamic = "force-dynamic";

const tabs = new Set(["financial", "revenue", "expenses", "occupancy", "utilities", "deposits"] as const);
type ReportTab = "financial" | "revenue" | "expenses" | "occupancy" | "utilities" | "deposits";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const parsedYear = Number(params.year);
  const year = Number.isInteger(parsedYear) ? parsedYear : now.getFullYear();
  const tab = tabs.has(params.tab as ReportTab) ? (params.tab as ReportTab) : "financial";
  const view = await getReportsProjection(year);
  if (!view) return null;
  return <ReportsView view={view} initialTab={tab} />;
}
