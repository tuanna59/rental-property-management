import { PeopleDirectory } from "@/modules/people/components/people-directory";
import {
  getPeopleDirectory,
  getPeopleDirectoryStats,
} from "@/modules/people/server/people.queries";
import { getPrimaryPropertyDashboard } from "@/modules/property/server/property.queries";
import { getServerTranslator } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    person?: string;
    archived?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const scope = ["all", "current", "upcoming", "former"].includes(
    params.scope ?? "",
  )
    ? params.scope!
    : "all";
  const renderedAt = new Date().toISOString();
  const [property, directory, stats, t] = await Promise.all([
    getPrimaryPropertyDashboard(),
    getPeopleDirectory(query),
    getPeopleDirectoryStats(),
    getServerTranslator("tenants"),
  ]);
  if (!property) return <main className="p-8">{t("noPropertyFound")}</main>;
  const showArchived = params.archived === "1";
  const people = directory.filter((person) => {
    if (Boolean(person.archivedAt) !== showArchived) return false;
    if (scope === "current") return person.rentalState === "CURRENT";
    if (scope === "upcoming") return person.rentalState === "UPCOMING";
    if (scope === "former") return person.rentalState === "FORMER";
    return true;
  });
  const selected =
    people.find((person) => person.id === params.person) ?? people[0] ?? null;
  return (
    <PeopleDirectory
      property={property}
      people={people}
      selected={selected}
      stats={stats}
      query={query}
      scope={scope}
      showArchived={showArchived}
      mobileDetail={Boolean(params.person && selected)}
      renderedAt={renderedAt}
    />
  );
}
