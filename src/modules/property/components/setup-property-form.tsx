"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  ChevronDown,
  Loader2,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import { completeSetupAction } from "@/app/setup/actions";
import { PreferencesDialog } from "@/components/preferences/preferences-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState } from "@/lib/action-state";
import {
  SPACE_TYPE_OPTIONS,
  type SpaceTypeValue,
} from "@/modules/property/domain/types";

type DraftSpace = {
  id: string;
  name: string;
  type: SpaceTypeValue;
};

type DraftFloor = {
  id: string;
  name: string;
  spaces: DraftSpace[];
};

export function SetupPropertyForm() {
  const t = useTranslations("setup");
  const tPreferences = useTranslations("preferences");
  const [state, action, pending] = useActionState(
    completeSetupAction,
    emptyActionState,
  );
  const nextFloorId = React.useRef(2);
  const nextSpaceId = React.useRef(1);
  const [floors, setFloors] = React.useState<DraftFloor[]>([
    {
      id: "floor-1",
      name: "",
      spaces: [],
    },
  ]);

  React.useEffect(() => {
    if (state.ok) {
      // A full navigation is intentional here. The root AppShell was rendered
      // before the first Property existed, so a client-only redirect can keep
      // that stale root layout mounted until the user manually refreshes.
      window.location.replace("/dashboard");
    }
  }, [state.ok]);

  const serializedFloors = React.useMemo(
    () =>
      JSON.stringify(
        floors.map((floor) => ({
          name: floor.name,
          spaces: floor.spaces.map((space) => ({
            name: space.name,
            type: space.type,
          })),
        })),
      ),
    [floors],
  );

  const addFloor = () => {
    const id = `floor-${nextFloorId.current++}`;
    setFloors((current) => [...current, { id, name: "", spaces: [] }]);
  };

  const removeFloor = (floorId: string) => {
    setFloors((current) => current.filter((floor) => floor.id !== floorId));
  };

  const updateFloorName = (floorId: string, name: string) => {
    setFloors((current) =>
      current.map((floor) =>
        floor.id === floorId ? { ...floor, name } : floor,
      ),
    );
  };

  const addSpace = (floorId: string) => {
    const id = `space-${nextSpaceId.current++}`;
    setFloors((current) =>
      current.map((floor) =>
        floor.id === floorId
          ? {
              ...floor,
              spaces: [
                ...floor.spaces,
                { id, name: "", type: "ROOM" as const },
              ],
            }
          : floor,
      ),
    );
  };

  const updateSpace = (
    floorId: string,
    spaceId: string,
    patch: Partial<Pick<DraftSpace, "name" | "type">>,
  ) => {
    setFloors((current) =>
      current.map((floor) =>
        floor.id === floorId
          ? {
              ...floor,
              spaces: floor.spaces.map((space) =>
                space.id === spaceId ? { ...space, ...patch } : space,
              ),
            }
          : floor,
      ),
    );
  };

  const removeSpace = (floorId: string, spaceId: string) => {
    setFloors((current) =>
      current.map((floor) =>
        floor.id === floorId
          ? {
              ...floor,
              spaces: floor.spaces.filter((space) => space.id !== spaceId),
            }
          : floor,
      ),
    );
  };

  return (
    <main className="min-h-screen bg-[var(--app-page-bg)] px-4 py-8 text-[var(--app-text-primary)] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-brand)]">
                Rental House
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
                {t("title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-text-secondary)]">
                {t("description")}
              </p>
            </div>
          </div>
          <PreferencesDialog
            trigger={
              <Button type="button" variant="outline" size="sm" className="self-start">
                <Settings2 aria-hidden="true" />
                {tPreferences("title")}
              </Button>
            }
          />
        </header>

        <PreservingActionForm action={action} className="space-y-5">
          <input type="hidden" name="floors" value={serializedFloors} />

          <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold">
                {t("propertyInformation")}
              </h2>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                {t("propertyInformationHint")}
              </p>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="setup-property-name">{t("propertyName")}</Label>
                <Input
                  id="setup-property-name"
                  name="name"
                  required
                  maxLength={120}
                  autoComplete="organization"
                  aria-invalid={Boolean(state.fieldErrors?.name?.length)}
                />
                {state.fieldErrors?.name?.[0] && (
                  <p className="text-xs text-[var(--app-danger)]">
                    {t("validation.propertyNameRequired")}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="setup-property-notes">{t("notes")}</Label>
                <Textarea
                  id="setup-property-notes"
                  name="description"
                  maxLength={1000}
                  placeholder={t("notesPlaceholder")}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">{t("structure")}</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text-secondary)]">
                  {t("structureHint")}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addFloor}>
                <Plus aria-hidden="true" />
                {t("addFloor")}
              </Button>
            </div>

            {state.fieldErrors?.floors?.[0] && (
              <p className="mt-4 rounded-md bg-[var(--app-danger-soft)] px-3 py-2 text-sm text-[var(--app-danger)]">
                {t("validation.atLeastOneFloor")}
              </p>
            )}

            <div className="mt-5 space-y-4">
              {floors.map((floor, floorIndex) => (
                <article
                  key={floor.id}
                  className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`${floor.id}-name`}>
                        {t("floorName", { number: floorIndex + 1 })}
                      </Label>
                      <Input
                        id={`${floor.id}-name`}
                        className="mt-2"
                        value={floor.name}
                        required
                        maxLength={120}
                        onChange={(event) =>
                          updateFloorName(floor.id, event.target.value)
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={floors.length === 1}
                      onClick={() => removeFloor(floor.id)}
                    >
                      <Trash2 aria-hidden="true" />
                      {t("removeFloor")}
                    </Button>
                  </div>

                  <div className="mt-5 border-t border-[var(--app-border)] pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{t("spaces")}</h3>
                        <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                          {t("spaceOrderHint")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addSpace(floor.id)}
                      >
                        <Plus aria-hidden="true" />
                        {t("addSpace")}
                      </Button>
                    </div>

                    {floor.spaces.length === 0 ? (
                      <p className="mt-4 rounded-md border border-dashed border-[var(--app-border-strong)] px-4 py-5 text-center text-sm text-[var(--app-text-muted)]">
                        {t("noSpaces")}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {floor.spaces.map((space, spaceIndex) => (
                          <div
                            key={space.id}
                            className="grid gap-3 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.65fr)_auto] sm:items-end"
                          >
                            <div className="grid gap-2">
                              <Label htmlFor={`${space.id}-name`}>
                                {t("spaceName", { number: spaceIndex + 1 })}
                              </Label>
                              <Input
                                id={`${space.id}-name`}
                                value={space.name}
                                required
                                maxLength={120}
                                placeholder={t("spaceNamePlaceholder")}
                                onChange={(event) =>
                                  updateSpace(floor.id, space.id, {
                                    name: event.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label>{t("spaceType")}</Label>
                              <Select
                                value={space.type}
                                onValueChange={(value) =>
                                  updateSpace(floor.id, space.id, {
                                    type: value as SpaceTypeValue,
                                  })
                                }
                              >
                                <SelectTrigger aria-label={t("spaceType")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SPACE_TYPE_OPTIONS.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {getSpaceTypeLabel(t, type)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t("removeSpace")}
                              title={t("removeSpace")}
                              onClick={() => removeSpace(floor.id, space.id)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {state.message && !state.ok && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] px-4 py-3 text-sm text-[var(--app-danger)]"
            >
              {state.message}
            </div>
          )}

          <footer className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--app-text-secondary)]">
              {t("footerHint")}
            </p>
            <CompleteSetupButton pending={pending} />
          </footer>
        </PreservingActionForm>
      </div>
    </main>
  );
}

function CompleteSetupButton({ pending }: { pending: boolean }) {
  const t = useTranslations("setup");

  return (
    <Button type="submit" disabled={pending} className="sm:min-w-44">
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          {t("saving")}
        </>
      ) : (
        <>
          {t("complete")}
          <ChevronDown className="-rotate-90" aria-hidden="true" />
        </>
      )}
    </Button>
  );
}

type SetupSpaceTypeTranslator = (
  key:
    | "spaceTypes.room"
    | "spaceTypes.ownerHome"
    | "spaceTypes.garage"
    | "spaceTypes.rooftop"
    | "spaceTypes.commonArea"
    | "spaceTypes.storage"
    | "spaceTypes.other",
) => string;

function getSpaceTypeLabel(
  t: SetupSpaceTypeTranslator,
  type: SpaceTypeValue,
) {
  switch (type) {
    case "ROOM":
      return t("spaceTypes.room");
    case "OWNER_HOME":
      return t("spaceTypes.ownerHome");
    case "GARAGE":
      return t("spaceTypes.garage");
    case "ROOFTOP":
      return t("spaceTypes.rooftop");
    case "COMMON_AREA":
      return t("spaceTypes.commonArea");
    case "STORAGE":
      return t("spaceTypes.storage");
    case "OTHER":
      return t("spaceTypes.other");
  }
}

