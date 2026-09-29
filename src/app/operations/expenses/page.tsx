import { ExpensesDashboard } from "@/modules/operations/components/expenses-dashboard";
import { OperationsShell } from "@/modules/operations/components/operations-shell";
import { getExpensePage } from "@/modules/operations/server/operations.queries";
import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const property = await getPrimaryPropertyDashboard();
  if (!property) return null;
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : new Date().toISOString().slice(0, 7);
  return (
    <OperationsShell>
      <ExpensesDashboard
        propertyId={property.id}
        month={month}
        view={await getExpensePage(property.id, month)}
      />
    </OperationsShell>
  );
}
