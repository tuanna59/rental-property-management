"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Eye, Pencil, Plus } from "lucide-react";
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
import { emptyActionState } from "@/lib/action-state";
import { formatDate, formatVnd } from "@/lib/presentation";
import {
  finalizeInvoiceAction,
  overrideInvoiceLineAction,
  recordPaymentAction,
  updatePaymentAction,
} from "../actions";
import type { getInvoice } from "../server/billing.queries";
import { BillingStatusBadge } from "./billing-status";
import {
  exportInvoicePng,
  invoicePresentation,
  monthLabel,
} from "./invoice-export";

type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
type Tab = "charges" | "occupants" | "electricity" | "payments" | "history";

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const [tab, setTab] = React.useState<Tab>("charges");
  return (
    <div className="utilities-content invoice-detail-page">
      <header className="invoice-detail-header">
        <div>
          <Link
            className="billing-back-link"
            href={`/billing/invoices?month=${invoice.billingPeriod.toISOString().slice(0, 7)}`}
          >
            <ArrowLeft /> Back to invoices
          </Link>
          <p className="utilities-eyebrow">INVOICE · {invoice.room}</p>
          <h1>{monthLabel(invoice.billingPeriod)}</h1>
          <p>
            Service {formatDate(invoice.serviceStart)} →{" "}
            {formatDate(invoice.serviceEnd)}
          </p>
        </div>
        <div className="invoice-header-actions">
          <BillingStatusBadge status={invoice.status} />
          <InvoicePreviewDialog invoice={invoice} />
          {invoice.status === "DRAFT" ? (
            <FinalizeButton invoiceId={invoice.id} />
          ) : (
            <Button onClick={() => exportInvoicePng(invoice)}>
              <Download /> Export PNG
            </Button>
          )}
          {invoice.status === "FINALIZED" &&
            invoice.paymentStatus !== "PAID" && (
              <PaymentDialog invoice={invoice} />
            )}
        </div>
      </header>

      <section className="invoice-context-grid">
        <ContextCard
          label="Room"
          value={invoice.room}
          detail={invoice.propertyName}
        />
        <ContextCard
          label="Responsible renter"
          value={invoice.renterName}
          detail="Invoice snapshot"
        />
        <ContextCard
          label="Billing period"
          value={monthLabel(invoice.billingPeriod)}
          detail={`${formatDate(invoice.serviceStart)} → ${formatDate(invoice.serviceEnd)}`}
        />
        {invoice.status === "FINALIZED" ? (
          <>
            <ContextCard
              label="Total"
              value={formatVnd(invoice.total)}
              detail="Final billed value"
            />
            <ContextCard
              label="Paid"
              value={formatVnd(invoice.totalPaid)}
              detail="Recorded payments"
            />
            <ContextCard
              label="Balance"
              value={formatVnd(invoice.balance)}
              detail={title(invoice.paymentStatus)}
            />
          </>
        ) : (
          <ContextCard
            label="Payment summary"
            value="Available after finalization"
            detail="This invoice is still a draft"
          />
        )}
      </section>

      <nav className="invoice-tabs" aria-label="Invoice detail sections">
        {(
          [
            "charges",
            "occupants",
            "electricity",
            "payments",
            "history",
          ] as Tab[]
        ).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {title(item)}
          </button>
        ))}
      </nav>

      <section className="invoice-tab-panel">
        {tab === "charges" && <ChargesTab invoice={invoice} />}
        {tab === "occupants" && <OccupantsTab invoice={invoice} />}
        {tab === "electricity" && <ElectricityTab invoice={invoice} />}
        {tab === "payments" && <PaymentsTab invoice={invoice} />}
        {tab === "history" && <HistoryTab invoice={invoice} />}
      </section>
    </div>
  );
}

function ChargesTab({ invoice }: { invoice: Invoice }) {
  return (
    <div className="utility-table-wrap">
      <table className="utility-table invoice-charge-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Details</th>
            <th>Calculated</th>
            <th>Final</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td>
                <strong>{title(line.type)}</strong>
              </td>
              <td>{chargeDetail(line.type, line.metadata)}</td>
              <td>{formatVnd(line.calculatedAmount)}</td>
              <td>
                <strong>{formatVnd(line.finalAmount)}</strong>
              </td>
              <td>
                {line.isOverridden ? (
                  <BillingStatusBadge status="OVERRIDDEN" />
                ) : (
                  <span className="utility-subtle">Rounded</span>
                )}
              </td>
              <td>
                {invoice.status === "DRAFT" ? (
                  <OverrideDialog invoiceId={invoice.id} line={line} />
                ) : (
                  <span className="utility-subtle">Read only</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Invoice total</td>
            <td>
              <strong>{formatVnd(invoice.total)}</strong>
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OccupantsTab({ invoice }: { invoice: Invoice }) {
  const water = invoice.lines.find((line) => line.type === "WATER");
  const metadata = (water?.metadata ?? {}) as Record<string, unknown>;
  const occupants = Array.isArray(metadata.occupants)
    ? (metadata.occupants as Array<Record<string, unknown>>)
    : [];
  if (!occupants.length)
    return (
      <Empty
        title="No occupant water charges"
        description="This invoice snapshot contains no billable occupants."
      />
    );
  return (
    <>
      <div className="evidence-summary">
        <ContextCard
          label="Water rate"
          value={`${formatVnd(String(metadata.applicableRate ?? 0))} / person / month`}
          detail="Snapshot rate"
        />
        <ContextCard
          label="Calculated water"
          value={formatVnd(water?.calculatedAmount ?? "0")}
          detail="Before final rounding or override"
        />
        <ContextCard
          label="Final billed water"
          value={formatVnd(water?.finalAmount ?? "0")}
          detail={water?.isOverridden ? "Manual override" : "Invoice snapshot"}
        />
      </div>
      <div className="utility-table-wrap">
        <table className="utility-table">
          <thead>
            <tr>
              <th>Occupant</th>
              <th>Role</th>
              <th>Service period</th>
              <th>Billable time</th>
              <th>Calculated amount</th>
              <th>Final amount</th>
            </tr>
          </thead>
          <tbody>
            {occupants.map((occupant, index) => (
              <tr key={`${occupant.personName}-${index}`}>
                <td>
                  <strong>{String(occupant.personName)}</strong>
                </td>
                <td>{title(String(occupant.role ?? "occupant"))}</td>
                <td>
                  {occupant.startDate
                    ? formatDate(String(occupant.startDate))
                    : formatDate(invoice.serviceStart)}{" "}
                  →{" "}
                  {occupant.endDate
                    ? formatDate(String(occupant.endDate))
                    : formatDate(invoice.serviceEnd)}
                </td>
                <td>
                  {occupant.fullMonth
                    ? "Full month"
                    : `${occupant.billableDays} days`}
                </td>
                <td>{formatVnd(String(occupant.exactAmount ?? 0))}</td>
                <td>
                  {water?.isOverridden
                    ? "Included in line override"
                    : formatVnd(String(occupant.finalContribution ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ElectricityTab({ invoice }: { invoice: Invoice }) {
  const line = invoice.lines.find((item) => item.type === "ELECTRICITY");
  const metadata = (line?.metadata ?? {}) as Record<string, unknown>;
  const meters = Array.isArray(metadata.meterSegments)
    ? (metadata.meterSegments as Array<Record<string, unknown>>)
    : [];
  return (
    <>
      <div className="evidence-summary electricity-evidence">
        <ContextCard
          label="Physical usage"
          value={`${metadata.physicalUsage ?? 0} kWh`}
          detail={`Across ${meters.length} physical ${meters.length === 1 ? "meter" : "meters"}`}
        />
        <ContextCard
          label="Invoice usage"
          value={`${metadata.tenantKwh ?? 0} kWh`}
          detail="Tenant attributable to this invoice"
        />
        <ContextCard
          label="Vacant / property"
          value={`${metadata.vacantUsage ?? 0} kWh`}
          detail="Not billed"
        />
        <ContextCard
          label="Other tenancy usage"
          value={`${metadata.otherTenancyUsage ?? 0} kWh`}
          detail="Billed separately"
        />
        <ContextCard
          label={metadata.rateOverridden ? "Override rate" : "Applicable rate"}
          value={`${formatVnd(String(metadata.applicableRate ?? 0))} / kWh`}
          detail={
            metadata.rateOverridden
              ? String(metadata.overrideReason ?? "Room/month override")
              : "Effective rate"
          }
        />
        <ContextCard
          label="Invoice amount"
          value={formatVnd(line?.finalAmount ?? "0")}
          detail={`${metadata.tenantKwh ?? 0} kWh × ${formatVnd(String(metadata.applicableRate ?? 0))} / kWh`}
        />
      </div>
      <p className="billing-explainer">
        Physical meter usage is allocated across this invoice tenant, other
        tenancies, and vacant/property time. Only this invoice&apos;s attributable
        usage is billed here.
      </p>
      <h3>Physical meter evidence</h3>
      <div className="utility-table-wrap">
        <table className="utility-table">
          <thead>
            <tr>
              <th>Meter</th>
              <th>Previous anchor</th>
              <th>Closing / boundary</th>
              <th>Usage</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {meters.map((meter, index) => {
              const opening = meter.openingReading as Record<
                string,
                unknown
              > | null;
              const closing = meter.closingReading as Record<
                string,
                unknown
              > | null;
              return (
                <tr key={`${meter.meterNumber}-${index}`}>
                  <td>
                    <strong>{String(meter.meterNumber ?? "Unnumbered")}</strong>
                  </td>
                  <td>
                    {opening
                      ? `${opening.value} kWh · ${formatDate(String(opening.date))}`
                      : "—"}
                  </td>
                  <td>
                    {closing
                      ? `${closing.value} kWh · ${formatDate(String(closing.date))}`
                      : "—"}
                  </td>
                  <td>{String(meter.usage ?? 0)} kWh</td>
                  <td>
                    {meter.hasEstimatedReading ? (
                      <BillingStatusBadge status="ESTIMATED" />
                    ) : (
                      "Measured"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PaymentsTab({ invoice }: { invoice: Invoice }) {
  if (invoice.status === "DRAFT")
    return (
      <Empty
        title="Payments unavailable for drafts"
        description="Finalize the invoice before recording a payment."
      />
    );
  return (
    <>
      <div className="evidence-summary">
        <ContextCard
          label="Invoice total"
          value={formatVnd(invoice.total)}
          detail="Final billed value"
        />
        <ContextCard
          label="Paid"
          value={formatVnd(invoice.totalPaid)}
          detail={`${invoice.payments.length} payment records`}
        />
        <ContextCard
          label="Balance"
          value={formatVnd(invoice.balance)}
          detail={invoice.paymentStatus.toLowerCase()}
        />
      </div>
      <div className="section-heading-row">
        <div>
          <h3>Payment history</h3>
          <p className="utility-subtle">
            Payments and explicit deposit settlements.
          </p>
        </div>
        {invoice.paymentStatus !== "PAID" && (
          <PaymentDialog invoice={invoice} />
        )}
      </div>
      {invoice.payments.length ? (
        <div className="utility-table-wrap">
          <table className="utility-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.paymentDate)}</td>
                  <td>
                    {payment.isDepositApplication
                      ? "Deposit application"
                      : title(payment.method)}
                  </td>
                  <td>
                    <strong>{formatVnd(payment.amount)}</strong>
                  </td>
                  <td>{payment.reference ?? "—"}</td>
                  <td>
                    {payment.isDepositApplication ? (
                      <span className="utility-subtle">Ledger managed</span>
                    ) : (
                      <EditPaymentDialog payment={payment} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No payments"
          description="No payments have been recorded for this invoice."
        />
      )}
    </>
  );
}

function HistoryTab({ invoice }: { invoice: Invoice }) {
  const events = [
    {
      date: invoice.createdAt,
      title: "Draft created",
      detail: "Invoice snapshot generated",
    },
    ...invoice.lines
      .filter((line) => line.isOverridden)
      .map((line) => ({
        date: line.updatedAt,
        title: `${title(line.type)} overridden`,
        detail: line.overrideReason ?? "Final amount changed",
      })),
    ...(invoice.finalizedAt
      ? [
          {
            date: invoice.finalizedAt,
            title: "Invoice finalized",
            detail: "Snapshot became immutable",
          },
        ]
      : []),
    ...invoice.payments.map((payment) => ({
      date: payment.createdAt,
      title: payment.isDepositApplication
        ? "Deposit applied"
        : "Payment recorded",
      detail: `${formatVnd(payment.amount)} · ${payment.reference ?? title(payment.method)}`,
    })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());
  return (
    <div className="billing-timeline">
      {events.map((event, index) => (
        <div key={`${event.title}-${index}`}>
          <span />
          <time>{formatDate(event.date)}</time>
          <strong>{event.title}</strong>
          <p>{event.detail}</p>
        </div>
      ))}
    </div>
  );
}

function InvoicePreviewDialog({ invoice }: { invoice: Invoice }) {
  const presentation = invoicePresentation(invoice);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Eye /> Preview invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="invoice-preview-dialog">
        <DialogHeader>
          <DialogTitle>Invoice preview</DialogTitle>
          <DialogDescription>
            {invoice.status === "DRAFT"
              ? "Draft preview · not finalized"
              : "Finalized canonical invoice"}
          </DialogDescription>
        </DialogHeader>
        <article className="invoice-paper">
          <header>
            <div>
              <strong>{presentation.propertyName}</strong>
              <span>{presentation.status === "DRAFT" ? "DRAFT" : "FINALIZED"}</span>
            </div>
            <div className="invoice-paper-heading">
              <h2>INVOICE</h2>
              <p>#{presentation.invoiceNumber}</p>
            </div>
          </header>
          <dl className="invoice-paper-details">
            <div>
              <dt>Bill to</dt>
              <dd>{presentation.billTo}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{presentation.room}</dd>
            </div>
            <div>
              <dt>Billing period</dt>
              <dd>{presentation.billingPeriod}</dd>
            </div>
            <div>
              <dt>Service period</dt>
              <dd>{presentation.servicePeriod}</dd>
            </div>
          </dl>
          <div className="invoice-paper-table-heading">
            <span>Item</span>
            <span>Calculation</span>
            <span>Amount</span>
          </div>
          {presentation.lines.map((line) => (
            <div className="invoice-paper-line" key={line.id}>
              <strong>{line.label}</strong>
              <span>{line.calculation}</span>
              <strong>{formatVnd(line.amount)}</strong>
            </div>
          ))}
          <footer>
            <span>TOTAL</span>
            <strong>{formatVnd(presentation.total)}</strong>
          </footer>
        </article>
        {invoice.status === "FINALIZED" && (
          <DialogFooter>
            <Button onClick={() => exportInvoicePng(invoice)}>
              <Download /> Export PNG
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OverrideDialog({
  invoiceId,
  line,
}: {
  invoiceId: string;
  line: Invoice["lines"][number];
}) {
  const [state, action] = React.useActionState(
    overrideInvoiceLineAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit charge · {title(line.type)}</DialogTitle>
          <DialogDescription>
            Calculated {formatVnd(line.calculatedAmount)}. The original
            calculation remains preserved.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="lineId" value={line.id} />
          <Field
            label="Final amount"
            name="finalAmount"
            type="number"
            step="500"
            defaultValue={line.finalAmount}
            required
          />
          <Field
            label="Override reason"
            name="overrideReason"
            defaultValue={line.overrideReason ?? ""}
            required
          />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">Save charge</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ invoice }: { invoice: Invoice }) {
  const [state, action] = React.useActionState(
    recordPaymentAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoice.room} · {monthLabel(invoice.billingPeriod)} ·{" "}
            {invoice.renterName}
          </DialogDescription>
        </DialogHeader>
        <div className="payment-dialog-summary">
          <Info label="Invoice total" value={formatVnd(invoice.total)} />
          <Info label="Paid" value={formatVnd(invoice.totalPaid)} />
          <Info label="Remaining" value={formatVnd(invoice.balance)} />
        </div>
        <form action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <div className="dialog-grid">
            <Field
              label="Amount"
              name="amount"
              type="number"
              step="500"
              max={invoice.balance}
              defaultValue={invoice.balance}
              required
            />
            <Field
              label="Date"
              name="paymentDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <SelectMethod defaultValue="CASH" />
          <Field label="Reference" name="reference" />
          <Field label="Notes" name="notes" />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">Record payment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPaymentDialog({
  payment,
}: {
  payment: Invoice["payments"][number];
}) {
  const [state, action] = React.useActionState(
    updatePaymentAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
          <DialogDescription>
            Update this recorded transaction.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <input type="hidden" name="paymentId" value={payment.id} />
          <div className="dialog-grid">
            <Field
              label="Amount"
              name="amount"
              type="number"
              step="500"
              defaultValue={payment.amount}
              required
            />
            <Field
              label="Date"
              name="paymentDate"
              type="date"
              defaultValue={payment.paymentDate.toISOString().slice(0, 10)}
              required
            />
          </div>
          <SelectMethod defaultValue={payment.method} />
          <Field
            label="Reference"
            name="reference"
            defaultValue={payment.reference ?? ""}
          />
          <Field
            label="Notes"
            name="notes"
            defaultValue={payment.notes ?? ""}
          />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">Save payment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeButton({ invoiceId }: { invoiceId: string }) {
  const [state, action] = React.useActionState(
    finalizeInvoiceAction,
    emptyActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button>Finalize</Button>
      {state.message && (
        <small className={state.ok ? "form-success" : "form-error"}>
          {state.message}
        </small>
      )}
    </form>
  );
}
function ContextCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="invoice-context-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({
  title: heading,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="billing-empty">
      <strong>{heading}</strong>
      <p>{description}</p>
    </div>
  );
}
function Field({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  const id = React.useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
function SelectMethod({ defaultValue }: { defaultValue: string }) {
  return (
    <div className="field">
      <Label>Method</Label>
      <select name="method" defaultValue={defaultValue}>
        <option value="CASH">Cash</option>
        <option value="BANK_TRANSFER">Bank transfer</option>
        <option value="OTHER">Other</option>
      </select>
    </div>
  );
}
function title(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}
function chargeDetail(type: string, metadata: unknown) {
  const item = metadata as Record<string, unknown>;
  if (type === "RENT")
    return item.fullMonth
      ? `Monthly rent · ${formatVnd(String(item.monthlyRentVnd ?? 0))}`
      : `${formatVnd(String(item.monthlyRentVnd ?? 0))} × ${item.billableDays} / 30`;
  if (type === "ELECTRICITY")
    return `${item.tenantKwh ?? 0} kWh × ${formatVnd(String(item.applicableRate ?? 0))}`;
  const occupants = Array.isArray(item.occupants)
    ? (item.occupants as Array<Record<string, unknown>>)
    : [];
  return (
    occupants
      .map(
        (person) =>
          `${person.personName} · ${person.fullMonth ? "full month" : `${person.billableDays} days`}`,
      )
      .join(" · ") || "No billable occupants"
  );
}
