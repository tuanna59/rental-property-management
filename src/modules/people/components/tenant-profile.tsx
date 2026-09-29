"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FilePlus2,
  FileText,
  Gauge,
  History,
  House,
  IdCard,
  MoreHorizontal,
  NotebookPen,
  Phone,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
  UserRound,
  WalletCards,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrivateAttachmentPicker } from "@/components/ui/private-attachment";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthShortLocale, formatVndLocale } from "@/i18n/format";
import { toDateOnly } from "@/lib/presentation";
import type { DashboardProperty } from "@/modules/property/domain/types";
import {
  EndOccupancyDialog,
  MoveOccupantDialog,
} from "@/modules/tenancy/components/tenancy-dialogs";
import { changeRentAction } from "@/modules/tenancy/actions";

import {
  archivePersonAction,
  deletePersonDocumentAction,
  deletePersonMediaAction,
  revealCitizenIdAction,
  replacePersonDocumentAction,
  restorePersonAction,
  updatePersonAction,
  uploadPersonDocumentAction,
  uploadPersonMediaAction,
} from "../actions";
import { PersonFormDialog } from "./person-form-dialog";
import type {
  DirectoryPerson,
  HistoryItem,
  PersonDocumentView,
  TenantInvoice,
} from "./tenant-view";

export function TenantProfile({
  person,
  property,
  backHref,
  renderedAt,
}: {
  person: DirectoryPerson;
  property: DashboardProperty;
  backHref: string;
  renderedAt: string;
}) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  const [tab, setTab] = React.useState<PersonTab>("history");
  const asOfDate = React.useMemo(() => businessDateFromRenderedAt(renderedAt), [renderedAt]);
  const rooms = property.floors.flatMap((floor) =>
    floor.spaces
      .filter((space) => space.type === "ROOM")
      .map((space) => ({ id: space.id, name: `${space.name} · ${floor.name}` })),
  );
  const invoices = uniqueBy(
    person.rentalHistory.flatMap((item) => item.invoices),
    (item) => item.id,
  ).sort(
    (left, right) =>
      right.billingPeriod.getTime() - left.billingPeriod.getTime() ||
      right.invoiceDate.getTime() - left.invoiceDate.getTime(),
  );
  const payments = invoices
    .flatMap((invoice) =>
      invoice.payments.map((payment) => ({ ...payment, invoice })),
    )
    .sort(
      (left, right) => right.paymentDate.getTime() - left.paymentDate.getTime(),
    );
  const financial = financialSummary(person, invoices, payments);
  const primaryTenancy =
    person.currentTenancy ?? person.upcomingTenancy ?? person.lastTenancy;

  return (
    <div className="tenant-profile-workspace">
      <Link href={backHref} className="tenant-mobile-back">
        <ArrowLeft aria-hidden="true" />
        {t("backToTenants")}
      </Link>

      <TenantProfileHeader
        person={person}
        primaryTenancy={primaryTenancy}
        rooms={rooms}
        onOpenDocuments={() => setTab("documents")}
        asOfDate={asOfDate}
      />

      {person.currentTenancy && (
        <CurrentRentalCard tenancy={person.currentTenancy} />
      )}
      {!person.currentTenancy && person.upcomingTenancy && (
        <UpcomingRentalCard tenancy={person.upcomingTenancy} />
      )}

      <TenantNotesCard person={person} />

      <section className="tenant-financial-summary" aria-label={t("summary")}>
        <SummaryCard
          icon={<ReceiptText />}
          label={t("invoices")}
          value={String(financial.invoiceCount)}
          detail={t("outstandingCount", { count: financial.outstandingCount })}
          onClick={() => setTab("invoices")}
        />
        <SummaryCard
          icon={<WalletCards />}
          label={t("payments")}
          value={formatVndLocale(financial.paymentTotal, locale)}
          detail={
            financial.lastPayment
              ? t("lastPaid", { date: formatDateOnlyLocale(financial.lastPayment, locale) })
              : t("noPaymentsYet")
          }
          onClick={() => setTab("payments")}
        />
        <SummaryCard
          icon={<CircleDollarSign />}
          label={t("deposit")}
          value={formatVndLocale(financial.depositHeld, locale)}
          detail={Number(financial.depositHeld) > 0 ? t("held") : t("noDepositHeld")}
        />
        <SummaryCard
          icon={<Zap />}
          label={t("utilities")}
          value={formatVndLocale(financial.latestUtilityTotal, locale)}
          detail={financial.latestUtilityMonth ? t("billingLabel", { month: formatMonthShortLocale(financial.latestUtilityMonth, locale) }) : t("noUtilityBilling")}
          onClick={() => setTab("utilities")}
        />
      </section>

      <TenantTabs tab={tab} setTab={setTab} />
      <section className="tenant-tab-panel">
        {tab === "history" && <RentalHistoryTimeline person={person} asOfDate={asOfDate} />}
        {tab === "invoices" && <InvoicesTab invoices={invoices} />}
        {tab === "payments" && <PaymentsTab payments={payments} />}
        {tab === "utilities" && <UtilitiesTab invoices={invoices} />}
        {tab === "documents" && <DocumentsTab person={person} />}
      </section>
    </div>
  );
}

type PersonTab = "history" | "invoices" | "payments" | "utilities" | "documents";

function TenantProfileHeader({
  person,
  primaryTenancy,
  rooms,
  onOpenDocuments,
  asOfDate,
}: {
  person: DirectoryPerson;
  primaryTenancy: HistoryItem | null;
  rooms: Array<{ id: string; name: string }>;
  onOpenDocuments: () => void;
  asOfDate: Date;
}) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  const duration = profileTenancyDuration(person, primaryTenancy, asOfDate, t);

  return (
    <section className="tenant-profile-header" aria-label={t("tenantProfile")}>
      <ProfileAvatar person={person} />

      <div className="tenant-profile-main">
        <div className="tenant-profile-heading">
          <div className="tenant-name-line">
            <h2>{person.fullName}</h2>
            <LifecycleBadge person={person} />
          </div>
          <div className="tenant-profile-context" aria-label={t("identityDetails")}>
            <div className="tenant-profile-room-row">
              <span className="tenant-profile-context-item tenant-profile-room">
                <House aria-hidden="true" />
                <span>{profileContext(person, t)}</span>
              </span>
            </div>
            <div className="tenant-profile-contact-row">
              <span className="tenant-profile-context-item tenant-profile-contact">
                <Phone aria-hidden="true" />
                <span>{person.phone || t("phoneNotProvided")}</span>
              </span>
              <CitizenIdContextFact person={person} />
              <span className="tenant-profile-context-item tenant-profile-birthday">
                <CalendarDays aria-hidden="true" />
                <span>{person.dateOfBirth ? formatDateOnlyLocale(person.dateOfBirth, locale) : t("birthdayNotProvided")}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="tenant-profile-metadata" aria-label={t("metadata")}>
          <MetadataItem
            icon={<CalendarDays />}
            label={t("moveInDate")}
            value={primaryTenancy ? formatDateOnlyLocale(primaryTenancy.moveInDate, locale) : t("notProvided")}
            detail={duration ? `(${duration})` : null}
          />
          <MetadataItem
            icon={<CalendarClock />}
            label={t("moveOutDate")}
            value={
              primaryTenancy?.moveOutDate
                ? formatDateOnlyLocale(primaryTenancy.moveOutDate, locale)
                : primaryTenancy
                  ? "—"
                  : t("notProvided")
            }
            detail={primaryTenancy && !primaryTenancy.moveOutDate ? t("ongoing") : null}
          />
          <MetadataItem
            icon={<UserRound />}
            label={t("tenantType")}
            value={primaryTenancy ? (primaryTenancy.role === "RESPONSIBLE" ? t("responsible") : t("additional")) : t("notProvided")}
            className="tenant-meta-role"
          />
        </div>
      </div>

      <div className="tenant-profile-actions">
        {!person.archivedAt && <PersonFormDialog mode="edit" person={person} />}
        <PersonOverflow
          person={person}
          rooms={rooms}
          onOpenDocuments={onOpenDocuments}
        />
      </div>
    </section>
  );
}

type TenantPayment = TenantInvoice["payments"][number] & {
  invoice: TenantInvoice;
};

function ProfileAvatar({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const router = useRouter();
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await uploadPersonMediaAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  return (
    <div className="tenant-profile-avatar-wrap">
      <PersonAvatar person={person} large />
      {!person.archivedAt && (
        <form action={action} className="tenant-avatar-upload">
          <input type="hidden" name="personId" value={person.id} />
          <input type="hidden" name="kind" value="avatar" />
          <PrivateAttachmentPicker
            name="image"
            accept="image/jpeg,image/png,image/webp"
            required
            title={t("avatar")}
            emptyText={t("noAvatar")}
            actionLabel={person.hasAvatar ? t("replaceAvatar") : t("uploadAvatar")}
            kind="image"
            variant="icon"
            autoSubmit
          />
          {state.message && <span className="sr-only">{state.message}</span>}
        </form>
      )}
    </div>
  );
}

export function PersonAvatar({
  person,
  large = false,
}: {
  person: DirectoryPerson;
  large?: boolean;
}) {
  return person.hasAvatar ? (
    // Private media is intentionally served by the application route.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={large ? "tenant-avatar is-large" : "tenant-avatar"}
      src={`/api/people/${person.id}/media/avatar`}
      alt=""
    />
  ) : (
    <span
      className={`tenant-avatar tenant-avatar-fallback${large ? " is-large" : ""}`}
      aria-hidden="true"
    >
      {initials(person.fullName)}
    </span>
  );
}

function LifecycleBadge({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const label = person.archivedAt
    ? t("archived")
    : person.rentalState === "CURRENT"
      ? t("currentTenant")
      : person.rentalState === "UPCOMING"
        ? t("upcoming")
        : person.rentalState === "FORMER"
          ? t("formerTenant")
          : t("noRental");
  return (
    <span className={`tenant-state ${person.archivedAt ? "state-archived" : `state-${person.rentalState.toLowerCase()}`}`}>
      {label}
    </span>
  );
}

function PersonOverflow({
  person,
  rooms,
  onOpenDocuments,
}: {
  person: DirectoryPerson;
  rooms: Array<{ id: string; name: string }>;
  onOpenDocuments: () => void;
}) {
  const t = useTranslations("tenants");
  const router = useRouter();
  const serverAction = person.archivedAt ? restorePersonAction : archivePersonAction;
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await serverAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const movable =
    !person.archivedAt &&
    person.currentTenancy?.role === "ADDITIONAL"
      ? person.currentTenancy
      : null;
  return (
    <details className="tenant-overflow">
      <summary aria-label={t("morePersonActions")}>
        <MoreHorizontal aria-hidden="true" />
      </summary>
      <div className="tenant-overflow-menu">
        {movable && (
          <div className="tenant-overflow-tenancy-actions">
            <MoveOccupantDialog
              membershipId={movable.membershipId}
              personName={person.fullName}
              rooms={rooms.filter((room) => room.id !== movable.spaceId)}
            />
            <EndOccupancyDialog
              membershipId={movable.membershipId}
              personName={person.fullName}
            />
          </div>
        )}
        {!person.archivedAt && (
          <button type="button" onClick={onOpenDocuments}>
            <FilePlus2 aria-hidden="true" />
            {t("addDocument")}
          </button>
        )}
        <div className="tenant-overflow-separator" />
        <form action={action}>
          <input type="hidden" name="personId" value={person.id} />
          <button type="submit" className={!person.archivedAt ? "is-danger" : undefined}>
            {person.archivedAt ? <RotateCcw /> : <Archive />}
            {person.archivedAt ? t("restorePerson") : t("archivePerson")}
          </button>
        </form>
        {state.message && <small>{state.message}</small>}
      </div>
    </details>
  );
}

function MetadataItem({
  icon,
  label,
  value,
  detail,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string | null;
  className?: string;
}) {
  return (
    <div className={`tenant-meta-item ${className}`.trim()}>
      <small className="tenant-meta-label">{label}</small>
      <div className="tenant-meta-value-row">
        <span className="tenant-meta-icon" aria-hidden="true">{icon}</span>
        <span className="tenant-meta-copy">
          <strong>{value}</strong>
          {detail && <em>{detail}</em>}
        </span>
      </div>
    </div>
  );
}

function CitizenIdContextFact({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const masked = person.hasCitizenId
    ? `••••${person.citizenIdLast4 ?? ""}`
    : t("citizenIdNotProvided");
  return (
    <span className="tenant-profile-context-item tenant-profile-citizen-id">
      <IdCard aria-hidden="true" />
      <span className="citizen-id-value">
        <strong>{revealed ? formatCitizenId(revealed) : masked}</strong>
        {person.hasCitizenId && (
          <button
            type="button"
            disabled={pending}
            aria-label={revealed ? t("hideCitizenId") : t("revealCitizenId")}
            onClick={() => {
              if (revealed) {
                setRevealed(null);
                setMessage(null);
                return;
              }
              startTransition(async () => {
                const result = await revealCitizenIdAction(person.id);
                if (result.ok) {
                  setRevealed(result.value);
                  setMessage(null);
                } else {
                  setMessage(result.message);
                }
              });
            }}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </button>
        )}
        {message && <em className="form-error">{message}</em>}
      </span>
    </span>
  );
}

function CurrentRentalCard({ tenancy }: { tenancy: HistoryItem }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  return (
    <section className="tenant-rental-card">
      <div className="tenant-rental-topline">
        <div className="tenant-rental-identity">
          <span className="tenant-card-kicker">{t("currentRental")}</span>
          <strong>
            {tenancy.spaceName}
            <span> · {tenancy.floorName}</span>
          </strong>
          {tenancy.role === "RESPONSIBLE" && (
            <small className="tenant-rental-helper">
              {t("moveOutManagedBuilding")}
            </small>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/building">{t("openBuilding")}</Link>
        </Button>
      </div>
      <div className="tenant-rental-metrics">
        <RentalMetric
          label={t("monthlyRent")}
          value={t("perMonth", { amount: formatVndLocale(tenancy.currentRent.monthlyRentVnd, locale) })}
        />
        <RentalMetric
          label={t("effective")}
          value={formatDateOnlyLocale(tenancy.currentRent.effectiveFrom, locale)}
        />
        <RentalMetric
          label={t("nextRent")}
          value={tenancy.scheduledRent ? formatVndLocale(tenancy.scheduledRent.monthlyRentVnd, locale) : "—"}
          detail={tenancy.scheduledRent ? formatDateOnlyLocale(tenancy.scheduledRent.effectiveFrom, locale) : t("noScheduledChange")}
        />
      </div>
    </section>
  );
}

function UpcomingRentalCard({ tenancy }: { tenancy: HistoryItem }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  return (
    <section className="tenant-rental-card is-upcoming">
      <div className="tenant-rental-topline">
        <div className="tenant-rental-identity">
          <span className="tenant-card-kicker">{t("upcomingRental")}</span>
          <strong>{tenancy.spaceName}</strong>
          <small>{tenancy.floorName}</small>
        </div>
      </div>
      <div className="tenant-rental-metrics">
        <RentalMetric label={t("movesIn")} value={formatDateOnlyLocale(tenancy.moveInDate, locale)} />
        <RentalMetric
          label={t("monthlyRent")}
          value={t("perMonth", { amount: formatVndLocale(tenancy.currentRent.monthlyRentVnd, locale) })}
        />
        <RentalMetric label={t("status")} value={t("scheduled")} />
      </div>
    </section>
  );
}

function RentalMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="tenant-rental-metric">
      <small>{label}</small>
      <strong>{value}</strong>
      {detail && <em>{detail}</em>}
    </div>
  );
}

function TenantNotesCard({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await updatePersonAction(previous, data);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  const long = (person.notes?.length ?? 0) > 220;
  return (
    <section className="tenant-notes-card">
      <div className="tenant-notes-heading">
        <span>
          <NotebookPen aria-hidden="true" />
          <strong>{t("notes")}</strong>
        </span>
        {!person.archivedAt && !editing && (
          <button type="button" onClick={() => setEditing(true)}>
            {person.notes ? t("edit") : t("addNote")}
          </button>
        )}
      </div>
      {editing ? (
        <form action={action} className="tenant-notes-form">
          <input type="hidden" name="personId" value={person.id} />
          <input type="hidden" name="fullName" value={person.fullName} />
          <input type="hidden" name="phone" value={person.phone ?? ""} />
          <input
            type="hidden"
            name="dateOfBirth"
            value={person.dateOfBirth ? toDateOnly(person.dateOfBirth) : ""}
          />
          <Textarea name="notes" defaultValue={person.notes ?? ""} autoFocus />
          {state.message && (
            <small className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </small>
          )}
          <div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm">{t("save")}</Button>
          </div>
        </form>
      ) : (
        <>
          <p className={!expanded && long ? "is-clamped" : ""}>
            {person.notes || t("noNotesYet")}
          </p>
          {long && (
            <button className="tenant-show-more" type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? t("showLess") : t("showMore")}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="tenant-summary-heading">
        <span className="tenant-summary-icon">{icon}</span>
        <small>{label}</small>
      </span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </>
  );
  return onClick ? (
    <button type="button" className="tenant-summary-card" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="tenant-summary-card">{content}</div>
  );
}

function TenantTabs({
  tab,
  setTab,
}: {
  tab: PersonTab;
  setTab: (tab: PersonTab) => void;
}) {
  const t = useTranslations("tenants");
  const tabs: Array<[PersonTab, string]> = [
    ["history", t("rentalHistory")],
    ["invoices", t("invoices")],
    ["payments", t("payments")],
    ["utilities", t("utilities")],
    ["documents", t("documents")],
  ];
  return (
    <nav className="tenant-tabs" aria-label={t("tenantDetails")}>
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={tab === value ? "is-active" : ""}
          onClick={() => setTab(value)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function RentalHistoryTimeline({ person, asOfDate }: { person: DirectoryPerson; asOfDate: Date }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  if (!person.rentalHistory.length)
    return <EmptyTab icon={<History />} text={t("noRentalHistoryYet")} />;
  const history = [...person.rentalHistory].sort((left, right) => {
    const rank = (item: HistoryItem) =>
      tenancyState(item, asOfDate) === "CURRENT" ? 0 : tenancyState(item, asOfDate) === "UPCOMING" ? 1 : 2;
    return rank(left) - rank(right) || right.startDate.getTime() - left.startDate.getTime();
  });
  return (
    <div className="tenant-timeline">
      {history.map((item) => {
        const state = tenancyState(item, asOfDate);
        return (
          <article className="tenant-timeline-item" key={item.membershipId}>
            <span className="tenant-timeline-dot" aria-hidden="true" />
            <div className="tenant-timeline-main">
              <div className="tenant-timeline-title">
                <strong>
                  {formatDateOnlyLocale(item.startDate, locale)} — {item.endDate ? formatDateOnlyLocale(item.endDate, locale) : t("present")}
                </strong>
                <span className="tenant-timeline-state">
                  <span className={`tenant-state state-${state.toLowerCase()}`}>{state === "CURRENT" ? t("currentState") : state === "UPCOMING" ? t("upcomingState") : t("formerState")}</span>
                  <em>{tenancyDuration(item.startDate, item.endDate ?? asOfDate, t)}</em>
                </span>
              </div>
              <p>{item.spaceName} · {item.role === "RESPONSIBLE" ? t("responsibleRenter") : t("additionalRenter")}</p>
              <small>{t("perMonth", { amount: formatVndLocale(item.currentRent.monthlyRentVnd, locale) })}</small>
              {item.scheduledRent && state === "CURRENT" && (
                <small className="tenant-timeline-scheduled">
                  {t("nextRentValue", { amount: formatVndLocale(item.scheduledRent.monthlyRentVnd, locale), date: formatDateOnlyLocale(item.scheduledRent.effectiveFrom, locale) })}
                </small>
              )}
              {state === "CURRENT" && (
                <div className="tenant-timeline-actions">
                  <ChangeRentDialog tenancy={item} />
                  <RentHistoryDialog tenancy={item} />
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function InvoicesTab({ invoices }: { invoices: TenantInvoice[] }) {
  const t = useTranslations("tenants");
  const tb = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  if (!invoices.length) return <EmptyTab icon={<ReceiptText />} text={t("noInvoices")} />;
  return (
    <div className="tenant-table-list">
      <div className="tenant-table-head">
        <span>{t("billingMonth")}</span><span>{t("room")}</span><span>{t("status")}</span><span>{t("total")}</span><span>{t("payment")}</span><span>{t("balance")}</span>
      </div>
      {invoices.map((invoice) => (
        <Link href={`/billing/invoices/${invoice.id}`} className="tenant-table-row" key={invoice.id}>
          <span>{invoice.type === "REGULAR" ? formatMonthShortLocale(invoice.billingPeriod, locale) : formatDateOnlyLocale(invoice.invoiceDate, locale)}</span>
          <span>{invoice.roomName}</span>
          <span>{invoice.status === "FINALIZED" ? tb("finalized") : tb("draft")}</span>
          <span>{formatVndLocale(invoice.amount, locale)}</span>
          <span>{invoice.displayStatus === "Paid" ? tb("paid") : invoice.displayStatus === "Partial" ? tb("partial") : invoice.displayStatus === "Unpaid" ? tb("unpaid") : invoice.displayStatus}</span>
          <span>{formatVndLocale(invoice.balance, locale)}</span>
        </Link>
      ))}
    </div>
  );
}

function PaymentsTab({ payments }: { payments: TenantPayment[] }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  if (!payments.length) return <EmptyTab icon={<WalletCards />} text={t("noPayments")} />;
  return (
    <div className="tenant-table-list payments-table">
      <div className="tenant-table-head">
        <span>{t("date")}</span><span>{t("invoice")}</span><span>{t("method")}</span><span>{t("amount")}</span><span>{t("reference")}</span>
      </div>
      {payments.map((payment) => (
        <Link href={`/billing/invoices/${payment.invoice.id}`} className="tenant-table-row" key={payment.id}>
          <span>{formatDateOnlyLocale(payment.paymentDate, locale)}</span>
          <span>{payment.invoice.type === "REGULAR" ? formatMonthShortLocale(payment.invoice.billingPeriod, locale) : t("finalSettlement")}</span>
          <span>{payment.isDepositApplication ? t("depositApplied") : payment.method === "BANK_TRANSFER" ? t("bankTransfer") : payment.method === "CASH" ? t("cash") : t("other")}</span>
          <span>{formatVndLocale(payment.amount, locale)}</span>
          <span>{payment.reference || "—"}</span>
        </Link>
      ))}
    </div>
  );
}

function UtilitiesTab({ invoices }: { invoices: TenantInvoice[] }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  const utilityInvoices = invoices.filter((invoice) => Number(invoice.utilities.total) > 0);
  if (!utilityInvoices.length) return <EmptyTab icon={<Gauge />} text={t("noUtilities")} />;
  return (
    <div className="tenant-table-list utilities-table">
      <div className="tenant-table-head">
        <span>{t("billingMonth")}</span><span>{t("room")}</span><span>{t("electricity")}</span><span>{t("water")}</span><span>{t("total")}</span>
      </div>
      {utilityInvoices.map((invoice) => (
        <Link href={`/billing/invoices/${invoice.id}`} className="tenant-table-row" key={invoice.id}>
          <span>{formatMonthShortLocale(invoice.billingPeriod, locale)}</span>
          <span>{invoice.roomName}</span>
          <span>
            {invoice.utilities.electricityUsage ? `${invoice.utilities.electricityUsage} kWh · ` : ""}
            {formatVndLocale(invoice.utilities.electricityCharge, locale)}
          </span>
          <span>{formatVndLocale(invoice.utilities.waterCharge, locale)}</span>
          <span>{formatVndLocale(invoice.utilities.total, locale)}</span>
        </Link>
      ))}
      <div className="tenant-tab-link-row">
        <Button variant="outline" size="sm" asChild><Link href="/utilities">{t("openUtilities")}</Link></Button>
      </div>
    </div>
  );
}

function DocumentsTab({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const contracts = person.documents.filter((document) => document.type === "RENTAL_CONTRACT");
  const custom = person.documents.filter((document) => document.type === "CUSTOM");
  return (
    <div className="tenant-documents">
      <div className="tenant-documents-heading">
        <span>
          <FileText aria-hidden="true" />
          <span>
            <strong>{t("privateDocuments")}</strong>
            <small>{t("privateDocumentsHelp")}</small>
          </span>
        </span>
        {!person.archivedAt && <AddDocumentDialog person={person} />}
      </div>

      <div className="tenant-documents-grid">
        {contracts.length ? (
          contracts.map((document) => (
            <StoredDocumentCard key={document.id} person={person} document={document} />
          ))
        ) : (
          <article className="tenant-document-card is-empty">
            <div className="tenant-document-preview"><FileText aria-hidden="true" /></div>
            <div>
              <strong>{t("rentalContract")}</strong>
              <small>{person.currentTenancy ? t("noContractForRoom", { room: person.currentTenancy.spaceName }) : t("notUploaded")}</small>
            </div>
          </article>
        )}
        <MediaSlot person={person} kind="citizen-front" label={t("idFront")} present={person.hasCitizenIdFront} />
        <MediaSlot person={person} kind="citizen-back" label={t("idBack")} present={person.hasCitizenIdBack} />
        {custom.map((document) => (
          <StoredDocumentCard key={document.id} person={person} document={document} />
        ))}
      </div>
    </div>
  );
}

function AddDocumentDialog({ person }: { person: DirectoryPerson }) {
  const t = useTranslations("tenants");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"RENTAL_CONTRACT" | "CUSTOM">("RENTAL_CONTRACT");
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await uploadPersonDocumentAction(previous, data);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  const tenancyId = person.currentTenancy?.tenancyId ?? person.upcomingTenancy?.tenancyId ?? "";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus />{t("addDocument")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addDocument")}</DialogTitle>
          <DialogDescription>{t("addDocumentDescription", { person: person.fullName })}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="person-form">
          <input type="hidden" name="personId" value={person.id} />
          {type === "RENTAL_CONTRACT" && tenancyId && (
            <input type="hidden" name="tenancyId" value={tenancyId} />
          )}
          <div className="grid gap-2">
            <Label>{t("type")}</Label>
            <select name="type" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              <option value="RENTAL_CONTRACT">{t("rentalContractOption")}</option>
              <option value="CUSTOM">{t("customOption")}</option>
            </select>
          </div>
          {type === "CUSTOM" && (
            <div className="grid gap-2">
              <Label>{t("titleLabel")}</Label>
              <input className="tenant-native-input" name="title" required placeholder={t("customTitlePlaceholder")} />
            </div>
          )}
          <div className="grid gap-2">
            <Label>{t("note")} <span className="tenant-optional-label">{t("optional")}</span></Label>
            <input className="tenant-native-input" name="note" />
          </div>
          <PrivateAttachmentPicker
            name="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            title={t("document")}
            emptyText={t("noFileSelected")}
            actionLabel={t("chooseDocument")}
            kind="file"
            helperText={t("documentFileHelp")}
          />
          {state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
          <DialogFooter><Button type="submit">{t("uploadDocument")}</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function StoredDocumentCard({
  person,
  document,
}: {
  person: DirectoryPerson;
  document: PersonDocumentView;
}) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [replaceState, replaceAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await replacePersonDocumentAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const [deleteState, deleteAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await deletePersonDocumentAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const url = `/api/people/${person.id}/documents/${document.id}`;
  const tenancy = person.rentalHistory.find((item) => item.tenancyId === document.tenancyId);
  return (
    <article className="tenant-document-card">
      <div className="tenant-document-preview"><FileText aria-hidden="true" /></div>
      <div className="tenant-document-copy">
        <strong>{document.title}</strong>
        <small>
          {document.type === "RENTAL_CONTRACT" ? t("rentalContract") : t("custom")}
          {tenancy ? ` · ${tenancy.spaceName}` : ""}
        </small>
        <em>{t("uploaded", { date: formatDateOnlyLocale(document.uploadedAt, locale) })}</em>
        {document.note && <p>{document.note}</p>}
      </div>
      <div className="tenant-document-actions">
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer"><Eye />{t("view")}</a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={`${url}?download=1`}><Download />{t("download")}</a>
        </Button>
        {!person.archivedAt && (
          <>
            <form action={replaceAction}>
              <input type="hidden" name="personId" value={person.id} />
              <input type="hidden" name="documentId" value={document.id} />
              <PrivateAttachmentPicker
                name="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                required
                title={t("replacementDocument")}
                emptyText={t("noReplacement")}
                actionLabel={t("replace")}
                kind="file"
                variant="inline"
                autoSubmit
              />
            </form>
            <form action={deleteAction}>
              <input type="hidden" name="personId" value={person.id} />
              <input type="hidden" name="documentId" value={document.id} />
              <button type="submit" className="tenant-document-delete"><Trash2 aria-hidden="true" />{t("delete")}</button>
            </form>
          </>
        )}
      </div>
      {(replaceState.message || deleteState.message) && (
        <small className={(replaceState.ok || deleteState.ok) ? "form-success" : "form-error"}>
          {replaceState.message || deleteState.message}
        </small>
      )}
    </article>
  );
}

function MediaSlot({
  person,
  kind,
  label,
  present,
}: {
  person: DirectoryPerson;
  kind: "citizen-front" | "citizen-back";
  label: string;
  present: boolean;
}) {
  const t = useTranslations("tenants");
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await uploadPersonMediaAction(previous, data);
      if (result.ok) {
        setImageFailed(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  const [deleteState, deleteAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await deletePersonMediaAction(previous, data);
      if (result.ok) {
        setImageFailed(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  const mediaUrl = `/api/people/${person.id}/media/${kind}`;
  return (
    <article className="tenant-document-card">
      <div className="tenant-document-preview">
        {present && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <FileImage aria-hidden="true" />
        )}
      </div>
      <div className="tenant-document-copy">
        <strong>{label}</strong>
        <small>{t("identityDocument")}</small>
        <em>{present && !imageFailed ? t("storedPrivately") : present ? t("previewUnavailable") : t("notUploaded")}</em>
      </div>
      <div className="tenant-document-actions">
        {present && !imageFailed && (
          <>
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Eye />{t("view")}</Button></DialogTrigger>
              <DialogContent className="media-preview-dialog">
                <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{t("privateIdentityDocument")}</DialogDescription></DialogHeader>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt={label} />
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" asChild><a href={`${mediaUrl}?download=1`}><Download />{t("download")}</a></Button>
          </>
        )}
        {!person.archivedAt && (
          <>
            <form action={action}>
              <input type="hidden" name="personId" value={person.id} />
              <input type="hidden" name="kind" value={kind} />
              <PrivateAttachmentPicker
                name="image"
                accept="image/jpeg,image/png,image/webp"
                required
                title={label}
                emptyText={t("noImageSelected")}
                actionLabel={present ? t("replace") : t("upload")}
                kind="image"
                variant="inline"
                autoSubmit
              />
            </form>
            {present && (
              <form action={deleteAction}>
                <input type="hidden" name="personId" value={person.id} />
                <input type="hidden" name="kind" value={kind} />
                <button type="submit" className="tenant-document-delete"><Trash2 aria-hidden="true" />{t("delete")}</button>
              </form>
            )}
          </>
        )}
      </div>
      {(state.message || deleteState.message) && (
        <small className={(state.ok || deleteState.ok) ? "form-success" : "form-error"}>{state.message || deleteState.message}</small>
      )}
    </article>
  );
}

function ChangeRentDialog({ tenancy }: { tenancy: HistoryItem }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await changeRentAction(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">{t("changeRent")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("changeMonthlyRent")}</DialogTitle><DialogDescription>{t("currentRent", { amount: formatVndLocale(tenancy.currentRent.monthlyRentVnd, locale) })}</DialogDescription></DialogHeader>
        <PreservingActionForm action={action} className="person-form">
          <input type="hidden" name="tenancyId" value={tenancy.tenancyId} />
          <div className="grid gap-2"><Label>{t("newMonthlyRent")}</Label><input className="tenant-native-input" name="monthlyRentVnd" type="number" step="10" required /></div>
          <div className="grid gap-2"><Label>{t("effectiveFrom")}</Label><input className="tenant-native-input" name="effectiveFrom" type="date" required /></div>
          <div className="grid gap-2"><Label>{t("reason")}</Label><input className="tenant-native-input" name="reason" required /></div>
          {state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
          <DialogFooter><Button type="submit">{t("saveNewRate")}</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function RentHistoryDialog({ tenancy }: { tenancy: HistoryItem }) {
  const t = useTranslations("tenants");
  const locale = useLocale() as AppLocale;
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="ghost">{t("viewRentHistory")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("rentHistory")}</DialogTitle><DialogDescription>{tenancy.spaceName}</DialogDescription></DialogHeader>
        <div className="tenant-simple-list">
          {tenancy.rentHistory.map((rate) => (
            <div key={rate.id}><span><strong>{formatDateOnlyLocale(rate.effectiveFrom, locale)}</strong><small>{rate.reason}</small></span><strong>{formatVndLocale(rate.monthlyRentVnd, locale)}</strong></div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyTab({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="tenant-tab-empty">{icon}<p>{text}</p></div>;
}

function financialSummary(
  person: DirectoryPerson,
  invoices: TenantInvoice[],
  payments: TenantPayment[],
) {
  const primary = person.currentTenancy ?? person.upcomingTenancy ?? person.lastTenancy;
  const normalPayments = payments.filter((payment) => !payment.isDepositApplication);
  const utilityInvoice = invoices.find((invoice) => Number(invoice.utilities.total) > 0);
  return {
    invoiceCount: invoices.length,
    outstandingCount: invoices.filter((invoice) => Number(invoice.balance) > 0).length,
    paymentTotal: String(normalPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)),
    lastPayment: normalPayments[0]?.paymentDate ?? null,
    depositHeld: primary?.depositHeld ?? "0",
    latestUtilityTotal: utilityInvoice?.utilities.total ?? "0",
    latestUtilityMonth: utilityInvoice?.billingPeriod ?? null,
  };
}

function profileContext(person: DirectoryPerson, t: ReturnType<typeof useTranslations>) {
  if (person.currentTenancy) return `${person.currentTenancy.spaceName} · ${person.currentTenancy.floorName}`;
  if (person.upcomingTenancy) return `${person.upcomingTenancy.spaceName} · ${person.upcomingTenancy.floorName}`;
  if (person.lastTenancy) return t("lastRented", { room: person.lastTenancy.spaceName });
  return t("noRentalHistory");
}

function profileTenancyDuration(
  person: DirectoryPerson,
  tenancy: HistoryItem | null,
  asOfDate: Date,
  t: ReturnType<typeof useTranslations>,
) {
  if (!tenancy || person.rentalState === "UPCOMING") return null;
  const end = person.rentalState === "CURRENT"
    ? asOfDate
    : tenancy.endDate ?? tenancy.moveOutDate ?? asOfDate;
  return tenancyDuration(tenancy.moveInDate, end, t);
}

function tenancyDuration(start: Date, end: Date, t: ReturnType<typeof useTranslations>) {
  const from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (to <= from) return t("lessThanDay");

  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();
  if (days < 0) {
    months -= 1;
    const previousMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0));
    days += previousMonth.getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts: string[] = [];
  if (years) parts.push(t("years", { count: years }));
  if (months) parts.push(t("months", { count: months }));
  if (days || !parts.length) parts.push(t("days", { count: days }));
  return parts.join(" ");
}

function tenancyState(item: HistoryItem, today: Date): "CURRENT" | "UPCOMING" | "FORMER" {
  return item.startDate > today ? "UPCOMING" : item.endDate && item.endDate <= today ? "FORMER" : "CURRENT";
}
function businessDateFromRenderedAt(renderedAt: string) {
  const value = new Date(renderedAt);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function formatCitizenId(value: string) {
  return value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
}
function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}
function uniqueBy<T>(items: T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
