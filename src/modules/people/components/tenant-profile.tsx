"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { formatDate, formatVnd, toDateOnly } from "@/lib/presentation";
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
        Back to tenants
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

      <section className="tenant-financial-summary" aria-label="Tenant summary">
        <SummaryCard
          icon={<ReceiptText />}
          label="Invoices"
          value={String(financial.invoiceCount)}
          detail={`${financial.outstandingCount} outstanding`}
          onClick={() => setTab("invoices")}
        />
        <SummaryCard
          icon={<WalletCards />}
          label="Payments"
          value={formatVnd(financial.paymentTotal)}
          detail={
            financial.lastPayment
              ? `Last paid ${formatDate(financial.lastPayment)}`
              : "No payments yet"
          }
          onClick={() => setTab("payments")}
        />
        <SummaryCard
          icon={<CircleDollarSign />}
          label="Deposit"
          value={formatVnd(financial.depositHeld)}
          detail={Number(financial.depositHeld) > 0 ? "Held" : "No deposit held"}
        />
        <SummaryCard
          icon={<Zap />}
          label="Utilities"
          value={formatVnd(financial.latestUtilityTotal)}
          detail={financial.latestUtilityMonth ?? "No utility billing yet"}
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
  const duration = profileTenancyDuration(person, primaryTenancy, asOfDate);

  return (
    <section className="tenant-profile-header" aria-label="Tenant profile">
      <ProfileAvatar person={person} />

      <div className="tenant-profile-main">
        <div className="tenant-profile-heading">
          <div className="tenant-name-line">
            <h2>{person.fullName}</h2>
            <LifecycleBadge person={person} />
          </div>
          <div className="tenant-profile-context" aria-label="Tenant identity details">
            <div className="tenant-profile-room-row">
              <span className="tenant-profile-context-item tenant-profile-room">
                <House aria-hidden="true" />
                <span>{profileContext(person)}</span>
              </span>
            </div>
            <div className="tenant-profile-contact-row">
              <span className="tenant-profile-context-item tenant-profile-contact">
                <Phone aria-hidden="true" />
                <span>{person.phone || "Phone not provided"}</span>
              </span>
              <CitizenIdContextFact person={person} />
              <span className="tenant-profile-context-item tenant-profile-birthday">
                <CalendarDays aria-hidden="true" />
                <span>{person.dateOfBirth ? formatDate(person.dateOfBirth) : "Birthday not provided"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="tenant-profile-metadata" aria-label="Tenant metadata">
          <MetadataItem
            icon={<CalendarDays />}
            label="Move-in date"
            value={primaryTenancy ? formatDate(primaryTenancy.moveInDate) : "Not provided"}
            detail={duration ? `(${duration})` : null}
          />
          <MetadataItem
            icon={<CalendarClock />}
            label="Move-out date"
            value={
              primaryTenancy?.moveOutDate
                ? formatDate(primaryTenancy.moveOutDate)
                : primaryTenancy
                  ? "—"
                  : "Not provided"
            }
            detail={primaryTenancy && !primaryTenancy.moveOutDate ? "Ongoing" : null}
          />
          <MetadataItem
            icon={<UserRound />}
            label="Tenant type"
            value={primaryTenancy ? shortRoleLabel(primaryTenancy.role) : "Not provided"}
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
            title="Avatar"
            emptyText="No avatar uploaded"
            actionLabel={person.hasAvatar ? "Replace avatar" : "Upload avatar"}
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
  const label = person.archivedAt
    ? "Archived"
    : person.rentalState === "CURRENT"
      ? "Current tenant"
      : person.rentalState === "UPCOMING"
        ? "Upcoming"
        : person.rentalState === "FORMER"
          ? "Former"
          : "No rental";
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
      <summary aria-label="More person actions">
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
            Add document
          </button>
        )}
        <div className="tenant-overflow-separator" />
        <form action={action}>
          <input type="hidden" name="personId" value={person.id} />
          <button type="submit" className={!person.archivedAt ? "is-danger" : undefined}>
            {person.archivedAt ? <RotateCcw /> : <Archive />}
            {person.archivedAt ? "Restore person" : "Archive person"}
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
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const masked = person.hasCitizenId
    ? `••••${person.citizenIdLast4 ?? ""}`
    : "Citizen ID not provided";
  return (
    <span className="tenant-profile-context-item tenant-profile-citizen-id">
      <IdCard aria-hidden="true" />
      <span className="citizen-id-value">
        <strong>{revealed ? formatCitizenId(revealed) : masked}</strong>
        {person.hasCitizenId && (
          <button
            type="button"
            disabled={pending}
            aria-label={revealed ? "Hide citizen ID" : "Reveal citizen ID"}
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
  return (
    <section className="tenant-rental-card">
      <div className="tenant-rental-topline">
        <div className="tenant-rental-identity">
          <span className="tenant-card-kicker">Current rental</span>
          <strong>
            {tenancy.spaceName}
            <span> · {tenancy.floorName}</span>
          </strong>
          {tenancy.role === "RESPONSIBLE" && (
            <small className="tenant-rental-helper">
              Move-out is managed from Building.
            </small>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Open building</Link>
        </Button>
      </div>
      <div className="tenant-rental-metrics">
        <RentalMetric
          label="Monthly rent"
          value={`${formatVnd(tenancy.currentRent.monthlyRentVnd)} / month`}
        />
        <RentalMetric
          label="Effective"
          value={formatDate(tenancy.currentRent.effectiveFrom)}
        />
        <RentalMetric
          label="Next rent"
          value={tenancy.scheduledRent ? formatVnd(tenancy.scheduledRent.monthlyRentVnd) : "—"}
          detail={tenancy.scheduledRent ? formatDate(tenancy.scheduledRent.effectiveFrom) : "No scheduled change"}
        />
      </div>
    </section>
  );
}

function UpcomingRentalCard({ tenancy }: { tenancy: HistoryItem }) {
  return (
    <section className="tenant-rental-card is-upcoming">
      <div className="tenant-rental-topline">
        <div className="tenant-rental-identity">
          <span className="tenant-card-kicker">Upcoming rental</span>
          <strong>{tenancy.spaceName}</strong>
          <small>{tenancy.floorName}</small>
        </div>
      </div>
      <div className="tenant-rental-metrics">
        <RentalMetric label="Moves in" value={formatDate(tenancy.moveInDate)} />
        <RentalMetric
          label="Monthly rent"
          value={`${formatVnd(tenancy.currentRent.monthlyRentVnd)} / month`}
        />
        <RentalMetric label="Status" value="Scheduled" />
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
          <strong>Notes</strong>
        </span>
        {!person.archivedAt && !editing && (
          <button type="button" onClick={() => setEditing(true)}>
            {person.notes ? "Edit" : "Add note"}
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
              Cancel
            </Button>
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      ) : (
        <>
          <p className={!expanded && long ? "is-clamped" : ""}>
            {person.notes || "No notes yet."}
          </p>
          {long && (
            <button className="tenant-show-more" type="button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "Show less" : "Show more"}
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
  const tabs: Array<[PersonTab, string]> = [
    ["history", "Rental history"],
    ["invoices", "Invoices"],
    ["payments", "Payments"],
    ["utilities", "Utilities"],
    ["documents", "Documents"],
  ];
  return (
    <nav className="tenant-tabs" aria-label="Tenant details">
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
  if (!person.rentalHistory.length)
    return <EmptyTab icon={<History />} text="No rental history yet." />;
  const history = [...person.rentalHistory].sort((left, right) => {
    const rank = (item: HistoryItem) =>
      tenancyState(item, asOfDate) === "Current" ? 0 : tenancyState(item, asOfDate) === "Upcoming" ? 1 : 2;
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
                  {formatDate(item.startDate)} — {item.endDate ? formatDate(item.endDate) : "Present"}
                </strong>
                <span className="tenant-timeline-state">
                  <span className={`tenant-state state-${state.toLowerCase()}`}>{state}</span>
                  <em>{tenancyDuration(item.startDate, item.endDate ?? asOfDate)}</em>
                </span>
              </div>
              <p>{item.spaceName} · {roleLabel(item.role)}</p>
              <small>{formatVnd(item.currentRent.monthlyRentVnd)} / month</small>
              {item.scheduledRent && state === "Current" && (
                <small className="tenant-timeline-scheduled">
                  Next {formatVnd(item.scheduledRent.monthlyRentVnd)} · {formatDate(item.scheduledRent.effectiveFrom)}
                </small>
              )}
              {state === "Current" && (
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
  if (!invoices.length) return <EmptyTab icon={<ReceiptText />} text="No invoices yet." />;
  return (
    <div className="tenant-table-list">
      <div className="tenant-table-head">
        <span>Billing month</span><span>Room</span><span>Status</span><span>Total</span><span>Payment</span><span>Balance</span>
      </div>
      {invoices.map((invoice) => (
        <Link href={`/billing/invoices/${invoice.id}`} className="tenant-table-row" key={invoice.id}>
          <span>{invoice.type === "REGULAR" ? monthLabel(invoice.billingPeriod) : formatDate(invoice.invoiceDate)}</span>
          <span>{invoice.roomName}</span>
          <span>{invoice.status === "FINALIZED" ? "Finalized" : "Draft"}</span>
          <span>{formatVnd(invoice.amount)}</span>
          <span>{invoice.displayStatus}</span>
          <span>{formatVnd(invoice.balance)}</span>
        </Link>
      ))}
    </div>
  );
}

function PaymentsTab({ payments }: { payments: TenantPayment[] }) {
  if (!payments.length) return <EmptyTab icon={<WalletCards />} text="No payments yet." />;
  return (
    <div className="tenant-table-list payments-table">
      <div className="tenant-table-head">
        <span>Date</span><span>Invoice</span><span>Method</span><span>Amount</span><span>Reference</span>
      </div>
      {payments.map((payment) => (
        <Link href={`/billing/invoices/${payment.invoice.id}`} className="tenant-table-row" key={payment.id}>
          <span>{formatDate(payment.paymentDate)}</span>
          <span>{payment.invoice.type === "REGULAR" ? monthLabel(payment.invoice.billingPeriod) : "Final settlement"}</span>
          <span>{payment.isDepositApplication ? "Deposit applied" : paymentMethod(payment.method)}</span>
          <span>{formatVnd(payment.amount)}</span>
          <span>{payment.reference || "—"}</span>
        </Link>
      ))}
    </div>
  );
}

function UtilitiesTab({ invoices }: { invoices: TenantInvoice[] }) {
  const utilityInvoices = invoices.filter((invoice) => Number(invoice.utilities.total) > 0);
  if (!utilityInvoices.length) return <EmptyTab icon={<Gauge />} text="No utility billing yet." />;
  return (
    <div className="tenant-table-list utilities-table">
      <div className="tenant-table-head">
        <span>Billing month</span><span>Room</span><span>Electricity</span><span>Water</span><span>Total</span>
      </div>
      {utilityInvoices.map((invoice) => (
        <Link href={`/billing/invoices/${invoice.id}`} className="tenant-table-row" key={invoice.id}>
          <span>{monthLabel(invoice.billingPeriod)}</span>
          <span>{invoice.roomName}</span>
          <span>
            {invoice.utilities.electricityUsage ? `${invoice.utilities.electricityUsage} kWh · ` : ""}
            {formatVnd(invoice.utilities.electricityCharge)}
          </span>
          <span>{formatVnd(invoice.utilities.waterCharge)}</span>
          <span>{formatVnd(invoice.utilities.total)}</span>
        </Link>
      ))}
      <div className="tenant-tab-link-row">
        <Button variant="outline" size="sm" asChild><Link href="/utilities">Open Utilities</Link></Button>
      </div>
    </div>
  );
}

function DocumentsTab({ person }: { person: DirectoryPerson }) {
  const contracts = person.documents.filter((document) => document.type === "RENTAL_CONTRACT");
  const custom = person.documents.filter((document) => document.type === "CUSTOM");
  return (
    <div className="tenant-documents">
      <div className="tenant-documents-heading">
        <span>
          <FileText aria-hidden="true" />
          <span>
            <strong>Private documents</strong>
            <small>Contracts, identity documents, and supporting files.</small>
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
              <strong>Rental contract</strong>
              <small>{person.currentTenancy ? `No contract uploaded for ${person.currentTenancy.spaceName}` : "Not uploaded"}</small>
            </div>
          </article>
        )}
        <MediaSlot person={person} kind="citizen-front" label="ID front" present={person.hasCitizenIdFront} />
        <MediaSlot person={person} kind="citizen-back" label="ID back" present={person.hasCitizenIdBack} />
        {custom.map((document) => (
          <StoredDocumentCard key={document.id} person={person} document={document} />
        ))}
      </div>
    </div>
  );
}

function AddDocumentDialog({ person }: { person: DirectoryPerson }) {
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
        <Button size="sm"><Plus />Add document</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>Upload a private PDF or image for {person.fullName}.</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="person-form">
          <input type="hidden" name="personId" value={person.id} />
          {type === "RENTAL_CONTRACT" && tenancyId && (
            <input type="hidden" name="tenancyId" value={tenancyId} />
          )}
          <div className="grid gap-2">
            <Label>Type</Label>
            <select name="type" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              <option value="RENTAL_CONTRACT">Rental contract</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          {type === "CUSTOM" && (
            <div className="grid gap-2">
              <Label>Title</Label>
              <input className="tenant-native-input" name="title" required placeholder="e.g. Parking agreement" />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Note <span className="tenant-optional-label">Optional</span></Label>
            <input className="tenant-native-input" name="note" />
          </div>
          <PrivateAttachmentPicker
            name="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            title="Document"
            emptyText="No file selected"
            actionLabel="Choose document"
            kind="file"
            helperText="PDF, JPEG, PNG, or WebP · up to 16 MB"
          />
          {state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
          <DialogFooter><Button type="submit">Upload document</Button></DialogFooter>
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
          {document.type === "RENTAL_CONTRACT" ? "Rental contract" : "Custom"}
          {tenancy ? ` · ${tenancy.spaceName}` : ""}
        </small>
        <em>Uploaded {formatDate(document.uploadedAt)}</em>
        {document.note && <p>{document.note}</p>}
      </div>
      <div className="tenant-document-actions">
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer"><Eye />View</a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={`${url}?download=1`}><Download />Download</a>
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
                title="Replacement document"
                emptyText="No replacement selected"
                actionLabel="Replace"
                kind="file"
                variant="inline"
                autoSubmit
              />
            </form>
            <form action={deleteAction}>
              <input type="hidden" name="personId" value={person.id} />
              <input type="hidden" name="documentId" value={document.id} />
              <button type="submit" className="tenant-document-delete"><Trash2 aria-hidden="true" />Delete</button>
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
        <small>Identity document</small>
        <em>{present && !imageFailed ? "Stored privately" : present ? "Preview unavailable" : "Not uploaded"}</em>
      </div>
      <div className="tenant-document-actions">
        {present && !imageFailed && (
          <>
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Eye />View</Button></DialogTrigger>
              <DialogContent className="media-preview-dialog">
                <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Private identity document</DialogDescription></DialogHeader>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt={label} />
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" asChild><a href={`${mediaUrl}?download=1`}><Download />Download</a></Button>
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
                emptyText="No image selected"
                actionLabel={present ? "Replace" : "Upload"}
                kind="image"
                variant="inline"
                autoSubmit
              />
            </form>
            {present && (
              <form action={deleteAction}>
                <input type="hidden" name="personId" value={person.id} />
                <input type="hidden" name="kind" value={kind} />
                <button type="submit" className="tenant-document-delete"><Trash2 aria-hidden="true" />Delete</button>
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
      <DialogTrigger asChild><Button size="sm" variant="outline">Change rent</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Change monthly rent</DialogTitle><DialogDescription>Current rent: {formatVnd(tenancy.currentRent.monthlyRentVnd)} / month</DialogDescription></DialogHeader>
        <PreservingActionForm action={action} className="person-form">
          <input type="hidden" name="tenancyId" value={tenancy.tenancyId} />
          <div className="grid gap-2"><Label>New monthly rent</Label><input className="tenant-native-input" name="monthlyRentVnd" type="number" step="10" required /></div>
          <div className="grid gap-2"><Label>Effective from</Label><input className="tenant-native-input" name="effectiveFrom" type="date" required /></div>
          <div className="grid gap-2"><Label>Reason</Label><input className="tenant-native-input" name="reason" required /></div>
          {state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
          <DialogFooter><Button type="submit">Save new rate</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function RentHistoryDialog({ tenancy }: { tenancy: HistoryItem }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="ghost">View rent history</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rent history</DialogTitle><DialogDescription>{tenancy.spaceName}</DialogDescription></DialogHeader>
        <div className="tenant-simple-list">
          {tenancy.rentHistory.map((rate) => (
            <div key={rate.id}><span><strong>{formatDate(rate.effectiveFrom)}</strong><small>{rate.reason}</small></span><strong>{formatVnd(rate.monthlyRentVnd)}</strong></div>
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
    latestUtilityMonth: utilityInvoice ? `${monthLabel(utilityInvoice.billingPeriod)} billing` : null,
  };
}

function profileContext(person: DirectoryPerson) {
  if (person.currentTenancy) return `${person.currentTenancy.spaceName} · ${person.currentTenancy.floorName}`;
  if (person.upcomingTenancy) return `${person.upcomingTenancy.spaceName} · ${person.upcomingTenancy.floorName}`;
  if (person.lastTenancy) return `Last rented ${person.lastTenancy.spaceName}`;
  return "No rental history";
}

function profileTenancyDuration(
  person: DirectoryPerson,
  tenancy: HistoryItem | null,
  asOfDate: Date,
) {
  if (!tenancy || person.rentalState === "UPCOMING") return null;
  const end = person.rentalState === "CURRENT"
    ? asOfDate
    : tenancy.endDate ?? tenancy.moveOutDate ?? asOfDate;
  return tenancyDuration(tenancy.moveInDate, end);
}

function tenancyDuration(start: Date, end: Date) {
  const from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (to <= from) return "Less than a day";

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
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months) parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  if (days || !parts.length) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  return parts.join(" ");
}

function tenancyState(item: HistoryItem, today: Date) {
  return item.startDate > today ? "Upcoming" : item.endDate && item.endDate <= today ? "Former" : "Current";
}
function businessDateFromRenderedAt(renderedAt: string) {
  const value = new Date(renderedAt);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(value);
}
function paymentMethod(value: TenantPayment["method"]) {
  return value === "BANK_TRANSFER" ? "Bank transfer" : value === "CASH" ? "Cash" : "Other";
}
function shortRoleLabel(role: HistoryItem["role"]) {
  return role === "RESPONSIBLE" ? "Responsible" : "Additional";
}

function roleLabel(role: HistoryItem["role"]) {
  return role === "RESPONSIBLE" ? "Responsible renter" : "Additional renter";
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
