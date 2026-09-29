"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Coins,
  Download,
  Droplets,
  Eye,
  FileText,
  Home,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyActionState } from "@/lib/action-state";
import { formatDate, formatVnd } from "@/lib/presentation";
import {
  addInvoiceAdjustmentAction,
  deleteInvoiceAdjustmentAction,
  finalizeInvoiceAction,
  overrideInvoiceLineAction,
  recordPaymentAction,
  updatePaymentAction,
  updateInvoiceAdjustmentAction,
} from "../actions";
import type { getInvoice } from "../server/billing.queries";
import { BillingStatusBadge } from "./billing-status";
import {
  exportInvoicePng,
  invoicePresentation,
  monthLabel,
} from "./invoice-export";

type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
type Tab = "charges" | "services" | "electricity" | "payments" | "history";

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
          <p className="utilities-eyebrow">
            {invoice.type === "REGULAR"
              ? "REGULAR INVOICE"
              : "FINAL SETTLEMENT"}{" "}
            · {invoice.room}
          </p>
          <h1>
            {invoice.type === "REGULAR"
              ? monthLabel(invoice.billingPeriod)
              : "Final settlement"}
          </h1>
          <p>
            {invoice.type === "REGULAR"
              ? "Regular invoice"
              : `${formatDate(invoice.invoiceDate)} · Move-out · ${invoice.room}`}
          </p>
        </div>
        <div className="invoice-header-actions">
          <BillingStatusBadge status={invoice.status} />
          {invoice.status === "FINALIZED" && (
            <BillingStatusBadge status={invoice.paymentStatus} />
          )}
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
          icon={<Home />}
        />
        <ContextCard
          label="Responsible renter"
          value={invoice.renterName}
          detail="Invoice snapshot"
          icon={<User />}
        />
        <ContextCard
          label="Invoice month"
          value={monthLabel(invoice.billingPeriod)}
          detail={
            invoice.type === "REGULAR"
              ? "Regular billing cycle"
              : formatDate(invoice.invoiceDate)
          }
          icon={<Calendar />}
        />
        <ContextCard
          label="Total"
          value={formatVnd(invoice.total)}
          detail={
            invoice.status === "FINALIZED"
              ? `Paid ${formatVnd(invoice.totalPaid)} · Balance ${formatVnd(invoice.balance)}`
              : "Draft total · payment available after finalization"
          }
          icon={<FileText />}
        />
      </section>

      <nav className="invoice-tabs" aria-label="Invoice detail sections">
        {(
          ["charges", "electricity", "services", "payments", "history"] as Tab[]
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
        {tab === "electricity" && <ElectricityTab invoice={invoice} />}
        {tab === "services" && <ServicesTab invoice={invoice} />}
        {tab === "payments" && <PaymentsTab invoice={invoice} />}
        {tab === "history" && <HistoryTab invoice={invoice} />}
      </section>
    </div>
  );
}

function ChargesTab({ invoice }: { invoice: Invoice }) {
  return (
    <>
      <div className="section-heading-row">
        <div>
          <h3>Charges</h3>
          <p className="utility-subtle">
            Source periods and final billed values.
          </p>
        </div>
        {invoice.status === "DRAFT" && (
          <AdjustmentDialog invoiceId={invoice.id} />
        )}
      </div>
      <div className="utility-table-wrap">
        <table className="utility-table invoice-charge-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Period</th>
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
                <td>
                  {line.sourceBillingMonth
                    ? monthLabel(line.sourceBillingMonth)
                    : "—"}
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
            {invoice.adjustments.map((adjustment) => (
              <tr key={adjustment.id}>
                <td>
                  <strong>Adjustment</strong>
                </td>
                <td>—</td>
                <td>
                  {adjustment.description}
                  {adjustment.reason?.trim() && (
                    <div className="utility-subtle">{adjustment.reason}</div>
                  )}
                </td>
                <td>—</td>
                <td>
                  <strong
                    className={
                      adjustment.type === "CREDIT" ? "deposit-negative" : ""
                    }
                  >
                    {adjustment.type === "CREDIT" ? "−" : ""}
                    {formatVnd(adjustment.amount)}
                  </strong>
                </td>
                <td>
                  {adjustment.type === "CHARGE"
                    ? "Additional charge"
                    : "Credit / discount"}
                </td>
                <td>
                  {invoice.status === "DRAFT" ? (
                    <div className="billing-actions">
                      <AdjustmentDialog
                        invoiceId={invoice.id}
                        adjustment={adjustment}
                      />
                      <DeleteAdjustmentButton
                        invoiceId={invoice.id}
                        adjustmentId={adjustment.id}
                      />
                    </div>
                  ) : (
                    <span className="utility-subtle">Read only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Invoice total</td>
              <td>
                <strong>{formatVnd(invoice.total)}</strong>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function ServicesTab({ invoice }: { invoice: Invoice }) {
  const water = invoice.lines.find((line) => line.type === "WATER");
  const metadata = (water?.metadata ?? {}) as Record<string, unknown>;
  const occupants = Array.isArray(metadata.occupants)
    ? (metadata.occupants as Array<Record<string, unknown>>)
    : [];
  if (!occupants.length)
    return (
      <Empty
        title="No service charges"
        description="No non-electric utility or service charges are included on this invoice."
      />
    );
  return (
    <>
      <div className="service-tab-heading">
        <h3>Services</h3>
        <p>Non-electric utility and service charges for this invoice.</p>
        {water?.sourceBillingMonth && (
          <p>
            <strong>Utility billing month</strong> ·{" "}
            {monthLabel(water.sourceBillingMonth)}
          </p>
        )}
        {water?.sourceBillingMonth &&
          water.sourceBillingMonth.getTime() !==
            invoice.billingPeriod.getTime() && (
            <small>
              These services are based on the utility period shown, which may
              differ from the invoice month.
            </small>
          )}
      </div>
      <section className="service-charge-section">
        <header>
          <div>
            <h3>Water</h3>
            <span>Per person</span>
          </div>
          <small>
            {water?.sourceBillingMonth
              ? monthLabel(water.sourceBillingMonth)
              : "Utility period"}
          </small>
        </header>
        <div className="evidence-summary service-summary">
          <ContextCard
            label="Rate"
            value={`${formatVnd(String(metadata.applicableRate ?? 0))} / person / month`}
            detail="Fixed rate"
            icon={<Coins />}
          />
          <ContextCard
            label="Calculated amount"
            value={formatVnd(water?.calculatedAmount ?? "0")}
            detail={`Based on ${metadata.totalOccupantDays ?? 0} occupant-days`}
            icon={<FileText />}
          />
          <ContextCard
            label="Final billed amount"
            value={formatVnd(water?.finalAmount ?? "0")}
            detail={
              water?.isOverridden
                ? "Manual override"
                : "Same snapshot calculation"
            }
            icon={<Receipt />}
          />
        </div>
        <h4>Occupant allocation</h4>
        <p className="utility-subtle">
          Water charges are allocated by occupant based on length of stay during
          the utility period.
        </p>
        <div className="utility-table-wrap">
          <table className="utility-table">
            <thead>
              <tr>
                <th>Occupant</th>
                <th>Role</th>
                <th>Service period</th>
                <th>Billable days</th>
                <th>Share</th>
                <th>Amount</th>
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
                    {formatDate(String(occupant.serviceStart))} →{" "}
                    {formatDate(String(occupant.serviceEnd))}
                  </td>
                  <td>{String(occupant.billableDays ?? 0)} days</td>
                  <td>{String(occupant.share ?? 0)}%</td>
                  <td>
                    {water?.isOverridden
                      ? "Included in line override"
                      : formatVnd(String(occupant.finalContribution ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td>{String(metadata.totalOccupantDays ?? 0)} occupant-days</td>
                <td>100%</td>
                <td>
                  <strong>{formatVnd(water?.finalAmount ?? "0")}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
}

function ElectricityTab({ invoice }: { invoice: Invoice }) {
  const line = invoice.lines.find((item) => item.type === "ELECTRICITY");
  if (!line)
    return (
      <Empty
        title="No electricity charge"
        description="This invoice contains no electricity obligation for the source period."
      />
    );
  const metadata = (line?.metadata ?? {}) as Record<string, unknown>;
  const meters = Array.isArray(metadata.meterSegments)
    ? (metadata.meterSegments as Array<Record<string, unknown>>)
    : [];
  return (
    <>
      <div className="service-tab-heading">
        <h3>Electricity</h3>
        <p>
          <strong>Utility billing month</strong> ·{" "}
          {line.sourceBillingMonth ? monthLabel(line.sourceBillingMonth) : "—"}
        </p>
        {line.sourceBillingMonth &&
          line.sourceBillingMonth.getTime() !==
            invoice.billingPeriod.getTime() && (
            <small>
              This charge comes from a utility period that differs from the
              invoice month.
            </small>
          )}
      </div>
      <div className="evidence-summary electricity-primary-summary">
        <ContextCard
          label="Invoice usage"
          value={`${metadata.tenantKwh ?? 0} kWh`}
          detail="Tenant-attributed to this invoice"
          icon={<Zap />}
        />
        <ContextCard
          label={metadata.rateOverridden ? "Override rate" : "Applicable rate"}
          value={`${formatVnd(String(metadata.applicableRate ?? 0))} / kWh`}
          detail={
            metadata.rateOverridden
              ? String(metadata.overrideReason ?? "Room/month override")
              : `${line.sourceBillingMonth ? monthLabel(line.sourceBillingMonth) : "Utility period"} rate`
          }
          icon={<Coins />}
        />
        <ContextCard
          label="Invoice amount"
          value={formatVnd(line?.finalAmount ?? "0")}
          detail={`${metadata.tenantKwh ?? 0} kWh × ${formatVnd(String(metadata.applicableRate ?? 0))} / kWh`}
          icon={<Receipt />}
        />
      </div>
      <section className="invoice-calculation-block">
        <h3>Calculation</h3>
        <p>
          {String(metadata.tenantKwh ?? 0)} kWh ×{" "}
          {formatVnd(String(metadata.applicableRate ?? 0))}/kWh
        </p>
        <div>
          <span>Calculated amount</span>
          <strong>{formatVnd(line.calculatedAmount)}</strong>
        </div>
        <div>
          <span>Final billed amount</span>
          <strong>{formatVnd(line.finalAmount)}</strong>
        </div>
        {line.isOverridden && (
          <div>
            <span>Override reason</span>
            <strong>{line.overrideReason ?? "—"}</strong>
          </div>
        )}
      </section>
      <section className="attribution-inline">
        <h3>Usage attribution</h3>
        <div>
          <span>This invoice</span>
          <strong>{String(metadata.tenantKwh ?? "Unknown")} kWh</strong>
        </div>
        <div>
          <span>Other tenancy</span>
          <strong>{String(metadata.otherTenancyUsage ?? "Unknown")} kWh</strong>
        </div>
        <div>
          <span>Vacant / property</span>
          <strong>{String(metadata.vacantUsage ?? "Unknown")} kWh</strong>
        </div>
      </section>
      <p className="billing-explainer">
        Physical meter usage is allocated across this invoice tenant, other
        tenancies, and vacant/property time. Only this invoice&apos;s
        attributable usage is billed here.
      </p>
      <h3>Physical meter evidence</h3>
      <div className="utility-table-wrap">
        <table className="utility-table">
          <thead>
            <tr>
              <th>Meter</th>
              <th>Previous anchor</th>
              <th>Monthly closing</th>
              <th>Billing end / boundary</th>
              <th>Closing usage</th>
              <th>Known usage</th>
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
              const monthlyClosing = meter.monthlyClosingReading as Record<
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
                      ? `${opening.value} kWh · ${formatDate(String(opening.date))} · ${readingLabel(opening)}`
                      : "—"}
                  </td>
                  <td>
                    {monthlyClosing
                      ? `${monthlyClosing.value} kWh · ${formatDate(String(monthlyClosing.date))}`
                      : "—"}
                  </td>
                  <td>
                    {closing
                      ? `${closing.value} kWh · ${formatDate(String(closing.date))} · ${readingLabel(closing)}`
                      : "—"}
                  </td>
                  <td>{String(meter.usage ?? 0)} kWh</td>
                  <td>{String(meter.knownUsage ?? meter.usage ?? 0)} kWh</td>
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
      <div className="evidence-summary service-summary">
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
                      ? "Deposit applied"
                      : title(payment.method)}
                  </td>
                  <td>
                    <strong>{formatVnd(payment.amount)}</strong>
                  </td>
                  <td>
                    {payment.isDepositApplication
                      ? "Applied from tenant deposit"
                      : (payment.reference ?? "—")}
                  </td>
                  <td>
                    {payment.isDepositApplication ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link href="/billing/deposits">View deposit</Link>
                      </Button>
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
      title:
        invoice.type === "FINAL_SETTLEMENT"
          ? "Final settlement generated"
          : "Draft created",
      detail:
        invoice.type === "FINAL_SETTLEMENT"
          ? "Move-out obligations captured"
          : "Invoice snapshot generated",
    },
    ...(invoice.type === "FINAL_SETTLEMENT"
      ? [
          {
            date: invoice.createdAt,
            title: "Move-out boundary used",
            detail: formatDate(invoice.invoiceDate),
          },
        ]
      : []),
    ...invoice.lines
      .filter((line) => line.isOverridden)
      .map((line) => ({
        date: line.updatedAt,
        title: `${title(line.type)} overridden`,
        detail: line.overrideReason ?? "Final amount changed",
      })),
    ...invoice.adjustments.map((adjustment) => ({
      date: adjustment.createdAt,
      title: "Adjustment added",
      detail: `${adjustment.description} · ${adjustment.type === "CREDIT" ? "−" : ""}${formatVnd(adjustment.amount)}`,
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
          <header className="invoice-paper-header">
            <div className="invoice-paper-brand">
              <span className="invoice-paper-brand-icon" aria-hidden="true">
                <Home />
              </span>
              <div>
                <strong>{presentation.propertyName}</strong>
                <span>Quản lý tiền thuê và tiện ích</span>
              </div>
            </div>
            <div className="invoice-paper-heading">
              <h2>{presentation.documentTitle}</h2>
              <p>#{presentation.invoiceNumber}</p>
              {presentation.isDraft && (
                <span className="invoice-paper-draft">BẢN NHÁP</span>
              )}
            </div>
          </header>

          <dl className="invoice-paper-details">
            <div>
              <dt>NGƯỜI THUÊ</dt>
              <dd>{presentation.billTo}</dd>
            </div>
            <div>
              <dt>PHÒNG</dt>
              <dd>{presentation.room}</dd>
            </div>
            <div>
              <dt>{presentation.billingLabel}</dt>
              <dd>{presentation.billingValue}</dd>
            </div>
          </dl>

          <div className="invoice-paper-table-heading">
            <span>Hạng mục</span>
            <span>Chi tiết / Cách tính</span>
            <span>Số lượng / Sử dụng</span>
            <span>Đơn giá</span>
            <span>Thành tiền</span>
          </div>
          <div className="invoice-paper-lines">
            {presentation.lines.map((line) => (
              <div className="invoice-paper-line" key={line.id}>
                <div className="invoice-paper-item">
                  <span className="invoice-paper-item-icon" aria-hidden="true">
                    {line.type === "RENT" ? (
                      <Home />
                    ) : line.type === "ELECTRICITY" ? (
                      <Zap />
                    ) : line.type === "WATER" ? (
                      <Droplets />
                    ) : (
                      <Receipt />
                    )}
                  </span>
                  <strong>{line.label}</strong>
                </div>
                <div className="invoice-paper-calculation">
                  <strong>{line.detail}</strong>
                  {line.detailNote && <span>{line.detailNote}</span>}
                </div>
                <span>{line.quantity}</span>
                <span>{line.rate}</span>
                <strong>{line.amount}</strong>
              </div>
            ))}
          </div>

          <div className="invoice-paper-total-row">
            <div className="invoice-paper-total">
              <span>Tổng thanh toán</span>
              <strong>{formatVnd(presentation.total)}</strong>
            </div>
          </div>

          <footer className="invoice-paper-footer">
            <div>
              <strong>{presentation.propertyName}</strong>
              <span>
                {presentation.isDraft
                  ? "Bản xem trước · chưa chốt"
                  : "Hóa đơn đã chốt"}
              </span>
            </div>
            <p>
              Hóa đơn điện tử được tạo bởi hệ thống.
              <br />
              Cảm ơn bạn đã thanh toán đúng hạn.
            </p>
          </footer>
        </article>
        {invoice.status === "FINALIZED" && (
          <DialogFooter>
            <Button onClick={() => exportInvoicePng(invoice)}>
              <Download /> Tải PNG
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
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="lineId" value={line.id} />
          <Field
            label="Final amount"
            name="finalAmount"
            type="number"
            step="10"
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
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDialog({
  invoiceId,
  adjustment,
}: {
  invoiceId: string;
  adjustment?: Invoice["adjustments"][number];
}) {
  const [state, action] = React.useActionState(
    adjustment ? updateInvoiceAdjustmentAction : addInvoiceAdjustmentAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={adjustment ? "ghost" : "outline"}>
          {adjustment ? <Pencil /> : <Plus />}
          {adjustment ? "Edit" : "Add adjustment"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {adjustment ? "Edit adjustment" : "Add adjustment"}
          </DialogTitle>
          <DialogDescription>
            Add an independent charge or credit without changing a service line.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          {adjustment && (
            <input type="hidden" name="adjustmentId" value={adjustment.id} />
          )}
          <div className="field">
            <Label>Type</Label>
            <select name="type" defaultValue={adjustment?.type ?? "CHARGE"}>
              <option value="CHARGE">Additional charge</option>
              <option value="CREDIT">Credit / discount</option>
            </select>
          </div>
          <Field
            label="Description"
            name="description"
            defaultValue={adjustment?.description ?? ""}
            required
          />
          <Field
            label="Amount"
            name="amount"
            type="number"
            min="1"
            step="1"
            defaultValue={adjustment?.amount ?? ""}
            required
          />
          <Field
            label="Reason (optional)"
            name="reason"
            defaultValue={adjustment?.reason ?? ""}
          />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              {adjustment ? "Save adjustment" : "Add adjustment"}
            </Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAdjustmentButton({
  invoiceId,
  adjustmentId,
}: {
  invoiceId: string;
  adjustmentId: string;
}) {
  const [state, action] = React.useActionState(
    deleteInvoiceAdjustmentAction,
    emptyActionState,
  );
  return (
    <form action={action} className="billing-inline-form">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="adjustmentId" value={adjustmentId} />
      <Button size="sm" variant="ghost" aria-label="Remove adjustment">
        <Trash2 />
      </Button>
      {state.message && (
        <small className={state.ok ? "form-success" : "form-error"}>
          {state.message}
        </small>
      )}
    </form>
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
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <div className="dialog-grid">
            <Field
              label="Amount"
              name="amount"
              type="number"
              step="1"
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
        </PreservingActionForm>
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
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="paymentId" value={payment.id} />
          <div className="dialog-grid">
            <Field
              label="Amount"
              name="amount"
              type="number"
              step="1"
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
        </PreservingActionForm>
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
  icon,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <article className="invoice-context-card">
      <span className="invoice-context-label">
        {label}
        {icon}
      </span>
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

function readingLabel(reading: Record<string, unknown>) {
  const labels: Record<string, string> = {
    MANUAL: "Manual reading",
    MONTHLY: "Legacy monthly reading",
    MOVE_IN: "Move-in",
    MOVE_OUT: "Move-out",
    METER_INSTALL: "Meter installed",
    METER_REMOVAL: "Meter removed",
  };
  return labels[String(reading.type ?? "")] ?? title(String(reading.type ?? "reading"));
}
