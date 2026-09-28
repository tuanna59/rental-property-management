"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Building2,
  Camera,
  FileImage,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { formatDate, formatVnd, toDateOnly } from "@/lib/presentation";
import type { DashboardProperty } from "@/modules/property/domain/types";
import { AppSidebar } from "@/modules/property/components/property-dashboard";
import {
  EndOccupancyDialog,
  MoveOccupantDialog,
} from "@/modules/tenancy/components/tenancy-dialogs";
import {
  changeRentAction,
  changeResponsibleAction,
} from "@/modules/tenancy/actions";

import {
  archivePersonAction,
  createPersonAction,
  revealCitizenIdAction,
  restorePersonAction,
  updatePersonAction,
  uploadPersonMediaAction,
} from "../actions";
import "./people.css";

type HistoryItem = {
  membershipId: string;
  tenancyId: string;
  role: "RESPONSIBLE" | "ADDITIONAL";
  startDate: Date;
  endDate: Date | null;
  moveInDate: Date;
  moveOutDate: Date | null;
  spaceId: string;
  spaceName: string;
  floorName: string;
  currentRent: RentRate;
  scheduledRent: RentRate | null;
  rentHistory: RentRate[];
  occupants: Array<{
    id: string;
    personId: string;
    personName: string;
    startDate: Date;
    endDate: Date | null;
  }>;
  responsibilityHistory: Array<{
    id: string;
    effectiveFrom: Date;
    reason: string;
    occupantId: string;
    personId: string;
    personName: string;
    previousPersonName: string | null;
  }>;
  invoices: TenantInvoice[];
};

type RentRate = {
  id: string;
  effectiveFrom: Date;
  monthlyRentVnd: string;
  reason: string;
};

type TenantInvoice = {
  id: string;
  billingPeriod: Date;
  invoiceDate: Date;
  type: "REGULAR" | "FINAL_SETTLEMENT";
  roomName: string;
  amount: string;
  balance: string;
  displayStatus: string;
  payments: Array<{
    id: string;
    paymentDate: Date;
    method: "CASH" | "BANK_TRANSFER" | "OTHER";
    amount: string;
    isDepositApplication: boolean;
  }>;
};

export type DirectoryPerson = {
  id: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: Date | null;
  citizenIdLast4: string | null;
  hasCitizenId: boolean;
  hasAvatar: boolean;
  hasCitizenIdFront: boolean;
  hasCitizenIdBack: boolean;
  notes: string | null;
  archivedAt: Date | null;
  rentalState: "CURRENT" | "UPCOMING" | "FORMER" | "NO_RENTAL";
  currentTenancy: HistoryItem | null;
  upcomingTenancy: HistoryItem | null;
  lastTenancy: HistoryItem | null;
  rentalHistory: HistoryItem[];
};

export function PeopleDirectory({
  property,
  people,
  selected,
  query,
  scope,
  showArchived,
}: {
  property: DashboardProperty;
  people: DirectoryPerson[];
  selected: DirectoryPerson | null;
  query: string;
  scope: string;
  showArchived: boolean;
}) {
  return (
    <main className="property-app people-app">
      <AppSidebar property={property} collapsed={false} />
      <div className="people-workspace">
        <header className="people-header">
          <Link
            href="/"
            className="mobile-people-home"
            aria-label="Back to building"
          >
            <Building2 />
          </Link>
          <div>
            <p className="eyebrow">PEOPLE &amp; RENTAL HISTORY</p>
            <h1>Tenants</h1>
            <p>People remain independent from rooms as tenancies change.</p>
          </div>
          <PersonFormDialog mode="create" />
        </header>
        <div className="people-layout">
          <section className="people-directory" aria-label="Tenant directory">
            <form className="people-search" action="/tenants">
              <Search aria-hidden="true" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search name or phone"
              />
              <input type="hidden" name="scope" value={scope} />
              {showArchived && (
                <input type="hidden" name="archived" value="1" />
              )}
            </form>
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
                  href={`/tenants?scope=${value}${showArchived ? "&archived=1" : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <Link
              className="archived-toggle"
              href={`/tenants?scope=${scope}${showArchived ? "" : "&archived=1"}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            >
              {showArchived ? "Show active people" : "View archived records"}
            </Link>
            <div className="people-list">
              {people.length ? (
                people.map((person) => (
                  <Link
                    key={person.id}
                    className={`person-row${selected?.id === person.id ? " is-selected" : ""}`}
                    href={`/tenants?scope=${scope}&person=${person.id}${showArchived ? "&archived=1" : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  >
                    <PersonAvatar person={person} />
                    <span>
                      <strong>{person.fullName}</strong>
                      <small>{directorySummary(person)}</small>
                      <span
                        className={`rental-badge state-${person.rentalState.toLowerCase()}`}
                      >
                        {person.rentalState === "NO_RENTAL"
                          ? "No rental"
                          : titleCase(person.rentalState)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="people-empty">
                  <UserRound />
                  <p>No people match this view.</p>
                </div>
              )}
            </div>
          </section>
          <section className="person-profile" aria-label="Person details">
            {selected ? (
              <PersonProfile
                key={selected.id}
                person={selected}
                property={property}
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

function PersonAvatar({ person }: { person: DirectoryPerson }) {
  return person.hasAvatar ? (
    // Private media is intentionally served by the application route.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/people/${person.id}/media/avatar`} alt="" />
  ) : (
    <span className="person-avatar-fallback" aria-hidden="true">
      {person.fullName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PersonProfile({
  person,
  property,
}: {
  person: DirectoryPerson;
  property: DashboardProperty;
}) {
  const rooms = property.floors.flatMap((floor) =>
    floor.spaces
      .filter((space) => space.type === "ROOM")
      .map((space) => ({
        id: space.id,
        name: `${space.name} · ${floor.name}`,
      })),
  );
  return (
    <div className="profile-content">
      <div className="profile-identity">
        <PersonAvatar person={person} />
        <div>
          <h2>{person.fullName}</h2>
          <p>{person.phone || "No phone number"}</p>
        </div>
        {!person.archivedAt && <PersonFormDialog mode="edit" person={person} />}
      </div>
      {person.currentTenancy && (
        <div className="current-rental">
          <span>Current rental</span>
          <strong>{person.currentTenancy.spaceName}</strong>
          <small>
            {person.currentTenancy.floorName} ·{" "}
            {roleLabel(person.currentTenancy.role)}
            {person.currentTenancy.moveOutDate &&
              ` · Moves out ${formatDate(person.currentTenancy.moveOutDate)}`}
          </small>
          <div className="rental-actions">
            {person.currentTenancy.role === "ADDITIONAL" ? (
              <>
                <MoveOccupantDialog
                  membershipId={person.currentTenancy.membershipId}
                  personName={person.fullName}
                  rooms={rooms.filter(
                    (room) => room.id !== person.currentTenancy?.spaceId,
                  )}
                />
                <EndOccupancyDialog
                  membershipId={person.currentTenancy.membershipId}
                  personName={person.fullName}
                />
              </>
            ) : (
              <span className="muted-copy">
                Whole-tenancy Move Out is managed from the Building.
              </span>
            )}
          </div>
        </div>
      )}
      {person.upcomingTenancy && (
        <div className="current-rental upcoming-rental">
          <span>Upcoming</span>
          <strong>{person.upcomingTenancy.spaceName}</strong>
          <small>
            Moves in {formatDate(person.upcomingTenancy.moveInDate)}
          </small>
        </div>
      )}
      <section className="profile-section">
        <h3>Personal details</h3>
        <dl className="profile-facts">
          <ProfileFact label="Phone" value={person.phone || "Not provided"} />
          <ProfileFact
            label="Date of birth"
            value={
              person.dateOfBirth
                ? formatDate(person.dateOfBirth)
                : "Not provided"
            }
          />
          <CitizenIdFact person={person} />
          <ProfileFact label="Notes" value={person.notes || "No notes"} />
        </dl>
      </section>
      <section className="profile-section">
        <h3>Private images</h3>
        <div className="media-slots">
          <MediaSlot
            person={person}
            kind="avatar"
            label="Avatar"
            icon={<Camera />}
            present={person.hasAvatar}
          />
          <MediaSlot
            person={person}
            kind="citizen-front"
            label="ID front"
            icon={<FileImage />}
            present={person.hasCitizenIdFront}
          />
          <MediaSlot
            person={person}
            kind="citizen-back"
            label="ID back"
            icon={<FileImage />}
            present={person.hasCitizenIdBack}
          />
        </div>
      </section>
      <PersonTabs person={person} />
      <PersonLifecycle person={person} />
    </div>
  );
}

type PersonTab = "history" | "invoices" | "payments" | "documents";

function PersonTabs({ person }: { person: DirectoryPerson }) {
  const [tab, setTab] = React.useState<PersonTab>("history");
  const invoices = uniqueBy(
    person.rentalHistory.flatMap((item) => item.invoices),
    (item) => item.id,
  );
  const payments = invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({ ...payment, invoice })),
  ).sort((left, right) => right.paymentDate.getTime() - left.paymentDate.getTime());
  return <section className="profile-section tenant-tab-section">
    <nav className="tenant-tabs" aria-label="Tenant details">
      {([['history', 'Rental history'], ['invoices', 'Invoices'], ['payments', 'Payments'], ['documents', 'Documents']] as const).map(([value, label]) => <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{label}</button>)}
    </nav>
    {tab === "history" && <RentalHistoryTab person={person} />}
    {tab === "invoices" && <InvoicesTab invoices={invoices} />}
    {tab === "payments" && <PaymentsTab payments={payments} />}
    {tab === "documents" && <p className="tenant-tab-empty">No documents yet.</p>}
  </section>;
}

function RentalHistoryTab({ person }: { person: DirectoryPerson }) {
  if (!person.rentalHistory.length) return <p className="tenant-tab-empty">No rental history yet.</p>;
  return <div className="rental-history tenant-rental-history">{person.rentalHistory.map((item) => {
    const upcomingChanges = item.responsibilityHistory.filter((event) => event.effectiveFrom > businessToday());
    return <article className="tenant-tenancy-card" key={item.membershipId}>
      <div className="tenant-tenancy-heading"><ShieldCheck /><div><strong>{item.spaceName}</strong><small>{item.floorName} · {tenancyState(item)} · {roleLabel(item.role)}</small></div><time>{formatDate(item.startDate)} – {item.endDate ? formatDate(item.endDate) : "Present"}</time></div>
      <div className="tenant-rent-summary"><span><small>Monthly rent</small><strong>{formatVnd(item.currentRent.monthlyRentVnd)} / month</strong><em>Effective since {formatDate(item.currentRent.effectiveFrom)}</em></span>{item.scheduledRent && <span className="scheduled-rent"><small>Scheduled</small><strong>{formatVnd(item.scheduledRent.monthlyRentVnd)} / month</strong><em>From {formatDate(item.scheduledRent.effectiveFrom)}</em></span>}</div>
      {upcomingChanges.map((event) => <div className="responsibility-event" key={event.id}><time>{formatDate(event.effectiveFrom)}</time><span><strong>Responsible renter changes</strong><small>{event.previousPersonName || "Current renter"} → {event.personName} · Upcoming</small></span></div>)}
      <div className="tenant-tenancy-actions"><ChangeRentDialog tenancy={item} /><RentHistoryDialog tenancy={item} />{item.occupants.length > 1 && <ChangeResponsibleDialog tenancy={item} />}</div>
    </article>;
  })}</div>;
}

function InvoicesTab({ invoices }: { invoices: TenantInvoice[] }) {
  if (!invoices.length) return <p className="tenant-tab-empty">No invoices yet.</p>;
  return <div className="tenant-data-list">{invoices.map((invoice) => <Link href={`/billing/invoices/${invoice.id}`} className="tenant-data-row" key={invoice.id}><span><strong>{invoice.type === "REGULAR" ? monthLabel(invoice.billingPeriod) : formatDate(invoice.invoiceDate)}</strong><small>{invoice.type === "REGULAR" ? "Regular" : "Final Settlement"} · {invoice.roomName}</small></span><span><strong>{formatVnd(invoice.amount)}</strong><small>Balance {formatVnd(invoice.balance)}</small></span><span className="rental-badge">{invoice.displayStatus}</span></Link>)}</div>;
}

type TenantPayment = TenantInvoice["payments"][number] & { invoice: TenantInvoice };
function PaymentsTab({ payments }: { payments: TenantPayment[] }) {
  if (!payments.length) return <p className="tenant-tab-empty">No payments yet.</p>;
  return <div className="tenant-data-list">{payments.map((payment) => <Link href={`/billing/invoices/${payment.invoice.id}`} className="tenant-data-row" key={payment.id}><span><strong>{formatDate(payment.paymentDate)}</strong><small>{payment.invoice.type === "FINAL_SETTLEMENT" ? "Final Settlement" : monthLabel(payment.invoice.billingPeriod)} · {payment.invoice.roomName}</small></span><span><strong>{formatVnd(payment.amount)}</strong><small>{payment.isDepositApplication ? "Deposit applied" : paymentMethod(payment.method)}</small></span></Link>)}</div>;
}

function ChangeRentDialog({ tenancy }: { tenancy: HistoryItem }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(async (previous: ActionState, data: FormData) => { const result = await changeRentAction(previous, data); if (result.ok) setOpen(false); return result; }, emptyActionState);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Change rent</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Change monthly rent</DialogTitle><DialogDescription>Current rent: {formatVnd(tenancy.currentRent.monthlyRentVnd)} / month</DialogDescription></DialogHeader><form action={action} className="person-form"><input type="hidden" name="tenancyId" value={tenancy.tenancyId} /><PersonField label="New monthly rent" name="monthlyRentVnd" type="number" step="10" required /><PersonField label="Effective from" name="effectiveFrom" type="date" required /><PersonField label="Reason" name="reason" required />{state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}<DialogFooter><Button type="submit">Save new rate</Button></DialogFooter></form></DialogContent></Dialog>;
}

function RentHistoryDialog({ tenancy }: { tenancy: HistoryItem }) {
  return <Dialog><DialogTrigger asChild><Button size="sm" variant="ghost">View rent history</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Rent history</DialogTitle><DialogDescription>{tenancy.spaceName}</DialogDescription></DialogHeader><div className="tenant-data-list">{tenancy.rentHistory.map((rate) => <div className="tenant-data-row" key={rate.id}><span><strong>{formatDate(rate.effectiveFrom)}</strong><small>{rate.reason}</small></span><strong>{formatVnd(rate.monthlyRentVnd)}</strong></div>)}</div></DialogContent></Dialog>;
}

function ChangeResponsibleDialog({ tenancy }: { tenancy: HistoryItem }) {
  const current = [...tenancy.responsibilityHistory].reverse().find((event) => event.effectiveFrom <= businessToday());
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(async (previous: ActionState, data: FormData) => { const result = await changeResponsibleAction(previous, data); if (result.ok) setOpen(false); return result; }, emptyActionState);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Change responsible</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Change responsible renter</DialogTitle><DialogDescription>Current responsible: {current?.personName ?? "Not assigned"}</DialogDescription></DialogHeader><form action={action} className="person-form"><input type="hidden" name="tenancyId" value={tenancy.tenancyId} /><div className="grid gap-2"><Label>New responsible</Label><select name="occupantId" required>{tenancy.occupants.filter((occupant) => occupant.id !== current?.occupantId).map((occupant) => <option key={occupant.id} value={occupant.id}>{occupant.personName}</option>)}</select></div><PersonField label="Effective from" name="effectiveFrom" type="date" required /><PersonField label="Reason" name="reason" required />{state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}<DialogFooter><Button type="submit">Change responsible</Button></DialogFooter></form></DialogContent></Dialog>;
}

function uniqueBy<T>(items: T[], key: (item: T) => string) { return [...new Map(items.map((item) => [key(item), item])).values()]; }
function businessToday() { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); }
function tenancyState(item: HistoryItem) { const today = businessToday(); return item.startDate > today ? "Upcoming" : item.endDate && item.endDate <= today ? "Former" : "Current"; }
function monthLabel(value: Date) { return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(value); }
function paymentMethod(value: TenantPayment["method"]) { return value === "BANK_TRANSFER" ? "Bank transfer" : value === "CASH" ? "Cash" : "Other"; }

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CitizenIdFact({ person }: { person: DirectoryPerson }) {
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const masked = person.hasCitizenId
    ? `•••• •••• ${person.citizenIdLast4 ?? ""}`
    : "Not provided";

  return (
    <div className="citizen-id-fact">
      <dt>Citizen ID</dt>
      <dd>
        <span>{revealed ? formatCitizenId(revealed) : masked}</span>
        {person.hasCitizenId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
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
            {pending ? "Loading" : revealed ? "Hide" : "Show"}
          </Button>
        )}
      </dd>
      {message && <small className="form-error">{message}</small>}
    </div>
  );
}

function MediaSlot({
  person,
  kind,
  label,
  icon,
  present,
}: {
  person: DirectoryPerson;
  kind: "avatar" | "citizen-front" | "citizen-back";
  label: string;
  icon: React.ReactNode;
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
  const mediaUrl = `/api/people/${person.id}/media/${kind}`;

  return (
    <div className="media-slot">
      {present && !imageFailed ? (
        // Private media is loaded only through the application route.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="media-thumbnail"
          src={mediaUrl}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        icon
      )}
      <span>
        <strong>{label}</strong>
        <small>
          {present && !imageFailed
            ? "Stored privately"
            : present
              ? "Preview unavailable"
              : "Not uploaded"}
        </small>
      </span>
      <div className="media-actions">
        {present && !imageFailed && (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogTrigger asChild>
              <button type="button" title={`View ${label}`}>
                <Eye />
              </button>
            </DialogTrigger>
            <DialogContent className="media-preview-dialog">
              <DialogHeader>
                <DialogTitle>{label}</DialogTitle>
                <DialogDescription>Private person image</DialogDescription>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt={label} />
            </DialogContent>
          </Dialog>
        )}
        {!person.archivedAt && (
          <form action={action}>
            <input type="hidden" name="personId" value={person.id} />
            <input type="hidden" name="kind" value={kind} />
            <label title={present ? `Replace ${label}` : `Upload ${label}`}>
              <Plus />
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
              />
            </label>
          </form>
        )}
      </div>
      {state.message && (
        <em className={state.ok ? "success" : "error"}>{state.message}</em>
      )}
    </div>
  );
}

function PersonFormDialog({
  mode,
  person,
}: {
  mode: "create" | "edit";
  person?: DirectoryPerson;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const action = mode === "create" ? createPersonAction : updatePersonAction;
  const [state, formAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus />
            Add person
          </Button>
        ) : (
          <Button variant="outline">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add person" : "Edit person"}
          </DialogTitle>
          <DialogDescription>
            Identity is kept separately from room assignments.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="person-form">
          {person && <input type="hidden" name="personId" value={person.id} />}
          <PersonField
            label="Full name"
            name="fullName"
            defaultValue={person?.fullName}
            required
            error={state.fieldErrors?.fullName?.[0]}
          />
          <PersonField
            label="Phone"
            name="phone"
            defaultValue={person?.phone ?? ""}
            error={state.fieldErrors?.phone?.[0]}
          />
          <PersonField
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            defaultValue={
              person?.dateOfBirth ? isoDate(person.dateOfBirth) : ""
            }
            error={state.fieldErrors?.dateOfBirth?.[0]}
          />
          <PersonField
            label={person?.hasCitizenId ? "Replace citizen ID" : "Citizen ID"}
            name="citizenId"
            autoComplete="off"
            error={state.fieldErrors?.citizenId?.[0]}
          />
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-notes`}>Notes</Label>
            <Textarea
              id={`${mode}-notes`}
              name="notes"
              defaultValue={person?.notes ?? ""}
            />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              {mode === "create" ? "Add person" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PersonField({
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  const id = React.useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function PersonLifecycle({ person }: { person: DirectoryPerson }) {
  const router = useRouter();
  const serverAction = person.archivedAt
    ? restorePersonAction
    : archivePersonAction;
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await serverAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  return (
    <form action={action} className="archive-person">
      <input type="hidden" name="personId" value={person.id} />
      <Button type="submit" variant="outline">
        {person.archivedAt ? <RotateCcw /> : <Archive />}
        {person.archivedAt ? "Restore person" : "Archive person"}
      </Button>
      {state.message && <span>{state.message}</span>}
    </form>
  );
}

function ProfileEmpty() {
  return (
    <div className="profile-empty">
      <UserRound />
      <h2>Person details</h2>
      <p>Select someone from the directory.</p>
    </div>
  );
}

const isoDate = toDateOnly;
const roleLabel = (role: HistoryItem["role"]) =>
  role === "RESPONSIBLE" ? "Responsible renter" : "Additional occupant";
const titleCase = (value: string) =>
  value.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const directorySummary = (person: DirectoryPerson) => {
  if (person.currentTenancy) {
    const moveOut = person.currentTenancy.moveOutDate
      ? ` · moves out ${formatDate(person.currentTenancy.moveOutDate)}`
      : "";
    return `${person.currentTenancy.spaceName} · ${roleLabel(person.currentTenancy.role)}${moveOut}`;
  }
  if (person.upcomingTenancy) {
    return `${person.upcomingTenancy.spaceName} · moves in ${formatDate(person.upcomingTenancy.moveInDate)}`;
  }
  if (person.lastTenancy) return `Last rented ${person.lastTenancy.spaceName}`;
  return person.phone || "No rental history";
};
const formatCitizenId = (value: string) =>
  value
    .replace(/\D/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
