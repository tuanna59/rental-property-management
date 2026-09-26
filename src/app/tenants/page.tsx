import { PeopleDirectory } from "@/modules/people/components/people-directory";
import { getPeopleDirectory } from "@/modules/people/server/queries";
import { getPrimaryPropertyDashboard } from "@/modules/property/server/queries";

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
  const [property, directory] = await Promise.all([
    getPrimaryPropertyDashboard(),
    getPeopleDirectory(query),
  ]);
  if (!property) return <main className="p-8">No property found.</main>;
  const people = directory.filter((person) => {
    const showArchived = params.archived === "1";
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
      query={query}
      scope={scope}
      showArchived={params.archived === "1"}
    />
  );
}
