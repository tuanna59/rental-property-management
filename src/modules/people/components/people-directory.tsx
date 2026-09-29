"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale } from "@/i18n/format";
import { CalendarDays, House, MoreHorizontal, Phone, Search, UserRound, Users } from "lucide-react";

import type { DashboardProperty } from "@/modules/property/domain/types";

import { PersonFormDialog } from "./person-form-dialog";
import { PersonAvatar, TenantProfile } from "./tenant-profile";
import type { DirectoryPerson, TenantStats } from "./tenant-view";
import "./people.css";

export type { DirectoryPerson } from "./tenant-view";

export function PeopleDirectory({
  property,
  people,
  selected,
  stats,
  query,
  scope,
  showArchived,
  mobileDetail,
  renderedAt,
}: {
  property: DashboardProperty;
  people: DirectoryPerson[];
  selected: DirectoryPerson | null;
  stats: TenantStats;
  query: string;
  scope: string;
  showArchived: boolean;
  mobileDetail: boolean;
  renderedAt: string;
}) {
  const t = useTranslations("tenants");
  const baseParams = new URLSearchParams();
  if (scope !== "all") baseParams.set("scope", scope);
  if (showArchived) baseParams.set("archived", "1");
  if (query) baseParams.set("q", query);
  const backHref = `/tenants${baseParams.toString() ? `?${baseParams}` : ""}`;

  return (
    <main className={`people-app${mobileDetail ? " is-mobile-detail" : ""}`}>
      <div className="people-workspace">
        <header className="people-header">
          <div className="people-header-copy">
            <p className="people-eyebrow">{t("eyebrow")}</p>
            <h1>{t("title")}</h1>
            <p className="people-description">
              {t("subtitle")}
            </p>
          </div>
          <PersonFormDialog mode="create" />
        </header>

        <TenantKpis stats={stats} t={t} />

        <div className="people-layout">
          <section className="people-directory" aria-label={t("directory")}>
            <div className="people-directory-toolbar">
              <form className="people-search" action="/tenants">
                <Search aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder={t("searchPlaceholder")}
                />
                <input type="hidden" name="scope" value={scope} />
                {showArchived && <input type="hidden" name="archived" value="1" />}
              </form>
              <div className="people-filter-row">
                <nav className="people-filters" aria-label={t("filtersLabel")}>
                  {[
                    ["all", t("all")],
                    ["current", t("current")],
                    ["upcoming", t("upcoming")],
                    ["former", t("former")],
                  ].map(([value, label]) => (
                    <Link
                      key={value}
                      className={scope === value ? "is-active" : ""}
                      href={directoryHref(value, showArchived, query)}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
                <details className="people-archive-menu">
                  <summary aria-label={t("moreDirectoryOptions")}>
                    <MoreHorizontal aria-hidden="true" />
                  </summary>
                  <div>
                    <Link
                      href={directoryHref(scope, !showArchived, query)}
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    >
                      {showArchived ? t("viewActivePeople") : t("viewArchivedPeople")}
                    </Link>
                  </div>
                </details>
              </div>
            </div>

            {showArchived && (
              <div className="people-archive-banner">
                {t("archivedBanner")}
              </div>
            )}

            <div className="people-list">
              {people.length ? (
                people.map((person) => (
                  <Link
                    key={person.id}
                    className={`person-row${selected?.id === person.id ? " is-selected" : ""}`}
                    href={personHref(person.id, scope, showArchived, query)}
                    aria-current={selected?.id === person.id ? "page" : undefined}
                  >
                    <PersonAvatar person={person} />
                    <span className="person-row-body">
                      <span className="person-row-identity">
                        <strong>{person.fullName}</strong>
                        <DirectoryRoom person={person} />
                        <span className="person-row-phone">
                          <Phone aria-hidden="true" />
                          {person.phone || t("noContact")}
                        </span>
                      </span>

                      <DirectoryRole person={person} />

                      <span className="person-row-state">
                        <LifecycleBadge person={person} />
                        <DirectoryLifecycleContext person={person} />
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="people-empty">
                  <UserRound aria-hidden="true" />
                  <p>{t("noPeople")}</p>
                </div>
              )}
            </div>
          </section>

          <section className="person-profile" aria-label={t("personDetails")}>
            {selected ? (
              <TenantProfile
                key={selected.id}
                person={selected}
                property={property}
                backHref={backHref}
                renderedAt={renderedAt}
              />
            ) : (
              <ProfileEmpty t={t} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function TenantKpis({ stats, t }: { stats: TenantStats; t: ReturnType<typeof useTranslations> }) {
  return (
    <section className="tenant-kpis" aria-label={t("summary")}>
      <Kpi
        icon={<Users />}
        label={t("totalPeople")}
        value={stats.total}
        detail={t("rentalHistoryCount", { count: stats.withRentalHistory })}
      />
      <Kpi
        icon={<House />}
        label={t("currentRenters")}
        value={stats.current}
        detail={
          stats.currentRooms
            ? t("occupiedRooms", { count: stats.currentRooms })
            : t("noOccupiedRooms")
        }
      />
      <Kpi
        icon={<CalendarDays />}
        label={t("upcoming")}
        value={stats.upcoming}
        detail={stats.upcoming ? t("scheduledMoveIns") : t("noScheduledMoveIns")}
      />
      <Kpi
        icon={<UserRound />}
        label={t("noRentalHistory")}
        value={stats.noRentalHistory}
        detail={stats.noRentalHistory ? t("needRentalAssignment") : t("everyoneHasRentalHistory")}
      />
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="tenant-kpi">
      <span className="tenant-kpi-icon">{icon}</span>
      <span className="tenant-kpi-content">
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </span>
    </article>
  );
}

function LifecycleBadge({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const label = person.archivedAt
    ? t("archived")
    : person.rentalState === "NO_RENTAL"
      ? t("noRental")
      : person.rentalState === "UPCOMING"
        ? t("future")
        : titleCase(person.rentalState);
  return (
    <span className={`tenant-list-state ${person.archivedAt ? "state-archived" : `state-${person.rentalState.toLowerCase()}`}`}>
      {label}
    </span>
  );
}

function ProfileEmpty({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="profile-empty">
      <UserRound aria-hidden="true" />
      <h2>{t("workspace")}</h2>
      <p>{t("selectPerson")}</p>
    </div>
  );
}

function directoryHref(scope: string, archived: boolean, query: string) {
  const params = new URLSearchParams();
  if (scope !== "all") params.set("scope", scope);
  if (archived) params.set("archived", "1");
  if (query) params.set("q", query);
  return `/tenants${params.toString() ? `?${params}` : ""}`;
}

function personHref(
  personId: string,
  scope: string,
  archived: boolean,
  query: string,
) {
  const params = new URLSearchParams();
  if (scope !== "all") params.set("scope", scope);
  params.set("person", personId);
  if (archived) params.set("archived", "1");
  if (query) params.set("q", query);
  return `/tenants?${params}`;
}

function DirectoryRoom({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const tenancy = person.currentTenancy ?? person.upcomingTenancy;
  if (tenancy) return <span className="person-row-room">{tenancy.spaceName}</span>;
  if (person.lastTenancy) {
    return <span className="person-row-room is-muted">{t("formerTenant")} · {person.lastTenancy.spaceName}</span>;
  }
  return <span className="person-row-room is-muted">{t("noRentalHistory")}</span>;
}

function DirectoryRole({ person }: { person: DirectoryPerson }) {
  const tenancy = person.currentTenancy ?? person.upcomingTenancy;
  if (!tenancy) return <span className="person-row-role-spacer" aria-hidden="true" />;

  const t = useTranslations("tenants");
  const role = tenancy.role === "RESPONSIBLE" ? t("responsible") : t("additional");
  return (
    <span className={`person-role-badge role-${tenancy.role.toLowerCase()}`}>
      <UserRound aria-hidden="true" />
      {role}
    </span>
  );
}

function DirectoryLifecycleContext({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  if (person.upcomingTenancy) {
    return (
      <small>{t("movesIn")} {formatDateOnlyLocale(person.upcomingTenancy.moveInDate, locale)}</small>
    );
  }
  if (person.lastTenancy?.moveOutDate && person.rentalState === "FORMER") {
    return <small>{t("moveOut")} · {formatDateOnlyLocale(person.lastTenancy.moveOutDate, locale)}</small>;
  }
  return null;
}


function titleCase(value: string) {
  return value.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}
