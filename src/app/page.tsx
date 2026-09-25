import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PropertyDashboard } from "@/modules/property/components/property-dashboard";
import { getPrimaryPropertyDashboard } from "@/modules/property/server/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const property = await getPrimaryPropertyDashboard();

  if (!property) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-4 text-[#172520]">
        <section className="flex max-w-md flex-col items-center rounded-lg border border-[#d8ded8] bg-white p-8 text-center shadow-sm">
          <Building2 className="size-12 text-[#1f6f5b]" />
          <h1 className="mt-4 text-2xl font-semibold">No property found</h1>
          <p className="mt-2 text-sm text-[#65756d]">
            Run the development seed to create the initial configurable rental
            property.
          </p>
          <Button className="mt-5" asChild>
            <a href="https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding">
              Seed workflow
            </a>
          </Button>
        </section>
      </main>
    );
  }

  return <PropertyDashboard property={property} />;
}
