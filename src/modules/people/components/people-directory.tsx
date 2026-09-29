"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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
            <p className="people-eyebrow">PEOPLE</p>
            <h1>Tenants</h1>
            <p className="people-description">
              People, rentals, billing, utilities, and private documents.
            </p>
          </div>
          <PersonFormDialog mode="create" />
        </header>

        <TenantKpis stats={stats} />

        <div className="people-layout">
          <section className="people-directory" aria-label="Tenant directory">
            <div className="people-directory-toolbar">
              <form className="people-search" action="/tenants">
                <Search aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search by name or phone"
                />
                <input type="hidden" name="scope" value={scope} />
                {showArchived && <input type="hidden" name="archived" value="1" />}
              </form>
              <div className="people-filter-row">
                <nav className="people-filters" aria-label="Directory filters">
                  {[
                    ["all", "All"],
                    ["current", "Current"],
                    ["upcoming", "Upcoming"],
                    ["former", "Former"],
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
                  <summary aria-label="More directory options">
                    <MoreHorizontal aria-hidden="true" />
                  </summary>
                  <div>
                    <Link
                      href={directoryHref(scope, !showArchived, query)}
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    >
                      {showArchived ? "View active people" : "View archived people"}
                    </Link>
                  </div>
                </details>
              </div>
            </div>

            {showArchived && (
              <div className="people-archive-banner">
                Archived people · read-only unless restored
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
                          {person.phone || "No contact details"}
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
                  <p>No people match this view.</p>
                </div>
              )}
            </div>
          </section>

          <section className="person-profile" aria-label="Person details">
            {selected ? (
              <TenantProfile
                key={selected.id}
                person={selected}
                property={property}
                backHref={backHref}
                renderedAt={renderedAt}
              />
            ) : (
              <ProfileEmpty />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function TenantKpis({ stats }: { stats: TenantStats }) {
  return (
    <section className="tenant-kpis" aria-label="Tenant summary">
      <Kpi
        icon={<Users />}
        label="Total people"
        value={stats.total}
        detail={`${stats.withRentalHistory} have rental history`}
      />
      <Kpi
        icon={<House />}
        label="Current renters"
        value={stats.current}
        detail={
          stats.currentRooms
            ? `Across ${stats.currentRooms} occupied ${stats.currentRooms === 1 ? "room" : "rooms"}`
            : "No occupied rooms"
        }
      />
      <Kpi
        icon={<CalendarDays />}
        label="Upcoming"
        value={stats.upcoming}
        detail={stats.upcoming ? "Scheduled move-ins" : "No scheduled move-ins"}
      />
      <Kpi
        icon={<UserRound />}
        label="No rental history"
        value={stats.noRentalHistory}
        detail={stats.noRentalHistory ? "Need rental assignment" : "Everyone has rental history"}
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
  const label = person.archivedAt
    ? "Archived"
    : person.rentalState === "NO_RENTAL"
      ? "No rental"
      : person.rentalState === "UPCOMING"
        ? "Future"
        : titleCase(person.rentalState);
  return (
    <span className={`tenant-list-state ${person.archivedAt ? "state-archived" : `state-${person.rentalState.toLowerCase()}`}`}>
      {label}
    </span>
  );
}

function ProfileEmpty() {
  return (
    <div className="profile-empty">
      <UserRound aria-hidden="true" />
      <h2>Tenant workspace</h2>
      <p>Select someone from the directory.</p>
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
  const tenancy = person.currentTenancy ?? person.upcomingTenancy;
  if (tenancy) return <span className="person-row-room">{tenancy.spaceName}</span>;
  if (person.lastTenancy) {
    return <span className="person-row-room is-muted">Last rented {person.lastTenancy.spaceName}</span>;
  }
  return <span className="person-row-room is-muted">No rental history</span>;
}

function DirectoryRole({ person }: { person: DirectoryPerson }) {
  const tenancy = person.currentTenancy ?? person.upcomingTenancy;
  if (!tenancy) return <span className="person-row-role-spacer" aria-hidden="true" />;

  const role = shortRole(tenancy.role);
  return (
    <span className={`person-role-badge role-${tenancy.role.toLowerCase()}`}>
      <UserRound aria-hidden="true" />
      {role}
    </span>
  );
}

function DirectoryLifecycleContext({ person }: { person: DirectoryPerson }) {
  if (person.upcomingTenancy) {
    return (
      <small>Moves in {shortFullDate(person.upcomingTenancy.moveInDate)}</small>
    );
  }
  if (person.lastTenancy?.moveOutDate && person.rentalState === "FORMER") {
    return <small>Moved out {shortFullDate(person.lastTenancy.moveOutDate)}</small>;
  }
  return null;
}

function shortRole(role: "RESPONSIBLE" | "ADDITIONAL") {
  return role === "RESPONSIBLE" ? "Responsible" : "Additional";
}

function shortFullDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}
