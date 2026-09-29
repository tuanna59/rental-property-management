import { redirect } from "next/navigation";

import { SetupPropertyForm } from "@/modules/property/components/setup-property-form";
import { hasExistingProperty } from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasExistingProperty()) {
    redirect("/dashboard");
  }

  return <SetupPropertyForm />;
}
