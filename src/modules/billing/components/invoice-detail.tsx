"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
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
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthLocale, formatNumberLocale, formatPercentLocale, formatVndLocale } from "@/i18n/format";
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
} from "./invoice-export";

type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
type Tab = "charges" | "services" | "electricity" | "payments" | "history";

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const [tab, setTab] = React.useState<Tab>("charges");
  return (
    <div className="utilities-content invoice-detail-page">
      <header className="invoice-detail-header">
        <div>
          <Link
            className="billing-back-link"
            href={`/billing/invoices?month=${invoice.billingPeriod.toISOString().slice(0, 7)}`}
          >
            <ArrowLeft /> {t("backToInvoices")}
          </Link>
          <p className="utilities-eyebrow">
            {invoice.type === "REGULAR"
              ? t("regularInvoiceEyebrow")
              : t("finalSettlementEyebrow")}{" "}
            · {invoice.room}
          </p>
          <h1>
            {invoice.type === "REGULAR"
              ? formatMonthLocale(invoice.billingPeriod, locale)
              : t("finalSettlement")}
          </h1>
          <p>
            {invoice.type === "REGULAR"
              ? t("regularInvoice")
              : `${formatDateOnlyLocale(invoice.invoiceDate, locale)} · ${t("moveOut")} · ${invoice.room}`}
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
            <Button onClick={() => exportInvoicePng(invoice, locale)}>
              <Download /> {t("exportPng")}
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
          label={t("room")}
          value={invoice.room}
          detail={invoice.propertyName}
          icon={<Home />}
        />
        <ContextCard
          label={t("responsibleRenter")}
          value={invoice.renterName}
          detail={t("invoiceSnapshot")}
          icon={<User />}
        />
        <ContextCard
          label={t("invoiceMonthLabel")}
          value={formatMonthLocale(invoice.billingPeriod, locale)}
          detail={
            invoice.type === "REGULAR"
              ? t("regularBillingCycle")
              : formatDateOnlyLocale(invoice.invoiceDate, locale)
          }
          icon={<Calendar />}
        />
        <ContextCard
          label={t("total")}
          value={formatVndLocale(invoice.total, locale)}
          detail={
            invoice.status === "FINALIZED"
              ? t("paidBalance", { paid: formatVndLocale(invoice.totalPaid, locale), balance: formatVndLocale(invoice.balance, locale) })
              : t("draftPaymentHelp")
          }
          icon={<FileText />}
        />
      </section>

      <nav className="invoice-tabs" aria-label={t("invoiceDetailSections")}>
        {(
          ["charges", "electricity", "services", "payments", "history"] as Tab[]
        ).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {tabLabel(item, t)}
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
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  return (
    <>
      <div className="section-heading-row">
        <div>
          <h3>{t("charges")}</h3>
<p className="utility-subtle">{t("chargesSubtitle")}</p>
        </div>
        {invoice.status === "DRAFT" && (
          <AdjustmentDialog invoiceId={invoice.id} />
        )}
      </div>
      <div className="utility-table-wrap">
        <table className="utility-table invoice-charge-table">
          <thead>
            <tr>
              <th>{t("type")}</th>
              <th>{t("period")}</th>
              <th>{t("details")}</th>
              <th>{t("calculated")}</th>
              <th>{t("final")}</th>
              <th>{t("status")}</th>
              <th>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <strong>{chargeTypeLabel(line.type, t)}</strong>
                </td>
                <td>
                  {line.sourceBillingMonth
                    ? formatMonthLocale(line.sourceBillingMonth, locale)
                    : "—"}
                </td>
                <td>{chargeDetail(line.type, line.metadata, t, locale)}</td>
                <td>{formatVndLocale(line.calculatedAmount, locale)}</td>
                <td>
                  <strong>{formatVndLocale(line.finalAmount, locale)}</strong>
                </td>
                <td>
                  {line.isOverridden ? (
                    <BillingStatusBadge status="OVERRIDDEN" />
                  ) : (
                    <span className="utility-subtle">{t("rounded")}</span>
                  )}
                </td>
                <td>
                  {invoice.status === "DRAFT" ? (
                    <OverrideDialog invoiceId={invoice.id} line={line} />
                  ) : (
                    <span className="utility-subtle">{t("readOnly")}</span>
                  )}
                </td>
              </tr>
            ))}
            {invoice.adjustments.map((adjustment) => (
              <tr key={adjustment.id}>
                <td>
                  <strong>{t("adjustment")}</strong>
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
                    {formatVndLocale(adjustment.amount, locale)}
                  </strong>
                </td>
                <td>
                  {adjustment.type === "CHARGE"
                    ? t("additionalCharge")
                    : t("creditDiscount")}
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
                    <span className="utility-subtle">{t("readOnly")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>{t("invoiceTotal")}</td>
              <td>
                <strong>{formatVndLocale(invoice.total, locale)}</strong>
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
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const water = invoice.lines.find((line) => line.type === "WATER");
  const metadata = (water?.metadata ?? {}) as Record<string, unknown>;
  const occupants = Array.isArray(metadata.occupants)
    ? (metadata.occupants as Array<Record<string, unknown>>)
    : [];
  if (!occupants.length)
    return (
      <Empty
        title={t("noServiceCharges")}
        description={t("noServiceChargesDetail")}
      />
    );
  return (
    <>
      <div className="service-tab-heading">
        <h3>{t("services")}</h3>
        <p>{t("servicesSubtitle")}</p>
        {water?.sourceBillingMonth && (
          <p>
            <strong>{t("utilityBillingMonth")}</strong> ·{" "}
            {formatMonthLocale(water.sourceBillingMonth, locale)}
          </p>
        )}
        {water?.sourceBillingMonth &&
          water.sourceBillingMonth.getTime() !==
            invoice.billingPeriod.getTime() && (
            <small>
              {t("servicesDifferenceNote")}
            </small>
          )}
      </div>
      <section className="service-charge-section">
        <header>
          <div>
            <h3>{t("water")}</h3>
            <span>{t("perPerson")}</span>
          </div>
          <small>
            {water?.sourceBillingMonth
              ? formatMonthLocale(water.sourceBillingMonth, locale)
              : t("utilityPeriod")}
          </small>
        </header>
        <div className="evidence-summary service-summary">
          <ContextCard
            label={t("rate")}
            value={t("ratePerPersonMonth", { rate: formatVndLocale(String(metadata.applicableRate ?? 0), locale) })}
            detail={t("fixedRate")}
            icon={<Coins />}
          />
          <ContextCard
            label={t("calculatedAmount")}
            value={formatVndLocale(water?.calculatedAmount ?? "0", locale)}
            detail={t("basedOnOccupantDays", { count: Number(metadata.totalOccupantDays ?? 0) })}
            icon={<FileText />}
          />
          <ContextCard
            label={t("finalBilledAmount")}
            value={formatVndLocale(water?.finalAmount ?? "0", locale)}
            detail={
              water?.isOverridden
                ? t("manualOverride")
                : t("sameSnapshotCalculation")
            }
            icon={<Receipt />}
          />
        </div>
        <h4>{t("occupantAllocation")}</h4>
        <p className="utility-subtle">
          {t("waterAllocationHelp")}
        </p>
        <div className="utility-table-wrap">
          <table className="utility-table">
            <thead>
              <tr>
                <th>{t("occupant")}</th>
                <th>{t("role")}</th>
                <th>{t("servicePeriod")}</th>
                <th>{t("billableDays")}</th>
                <th>{t("share")}</th>
                <th>{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {occupants.map((occupant, index) => (
                <tr key={`${occupant.personName}-${index}`}>
                  <td>
                    <strong>{String(occupant.personName)}</strong>
                  </td>
                  <td>{roleLabel(String(occupant.role ?? "occupant"), t)}</td>
                  <td>
                    {formatDateOnlyLocale(String(occupant.serviceStart), locale)} →{" "}
                    {formatDateOnlyLocale(String(occupant.serviceEnd), locale)}
                  </td>
                  <td>{t("daysCount", { count: Number(occupant.billableDays ?? 0) })}</td>
                  <td>{formatPercentLocale(Number(occupant.share ?? 0), locale)}</td>
                  <td>
                    {water?.isOverridden
                      ? t("includedInLineOverride")
                      : formatVndLocale(String(occupant.finalContribution ?? 0), locale)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>{t("total")}</td>
                <td>{t("occupantDays", { count: Number(metadata.totalOccupantDays ?? 0) })}</td>
                <td>100%</td>
                <td>
                  <strong>{formatVndLocale(water?.finalAmount ?? "0", locale)}</strong>
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
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const line = invoice.lines.find((item) => item.type === "ELECTRICITY");
  if (!line)
    return (
      <Empty
        title={t("noElectricityCharge")}
        description={t("noElectricityDetail")}
      />
    );
  const metadata = (line?.metadata ?? {}) as Record<string, unknown>;
  const meters = Array.isArray(metadata.meterSegments)
    ? (metadata.meterSegments as Array<Record<string, unknown>>)
    : [];
  return (
    <>
      <div className="service-tab-heading">
        <h3>{t("electricity")}</h3>
        <p>
          <strong>{t("utilityBillingMonth")}</strong> ·{" "}
          {line.sourceBillingMonth ? formatMonthLocale(line.sourceBillingMonth, locale) : "—"}
        </p>
        {line.sourceBillingMonth &&
          line.sourceBillingMonth.getTime() !==
            invoice.billingPeriod.getTime() && (
            <small>
              {t("electricityPeriodDifference")}
            </small>
          )}
      </div>
      <div className="evidence-summary electricity-primary-summary">
        <ContextCard
          label={t("invoiceUsage")}
          value={`${metadata.tenantKwh ?? 0} kWh`}
          detail={t("tenantAttributed")}
          icon={<Zap />}
        />
        <ContextCard
          label={metadata.rateOverridden ? t("overrideRate") : t("applicableRate")}
          value={`${formatVndLocale(String(metadata.applicableRate ?? 0), locale)} / kWh`}
          detail={
            metadata.rateOverridden
              ? String(metadata.overrideReason ?? t("roomMonthOverride"))
              : t("rateForPeriod", {
                  period: line.sourceBillingMonth
                    ? formatMonthLocale(line.sourceBillingMonth, locale)
                    : t("utilityPeriod"),
                })
          }
          icon={<Coins />}
        />
        <ContextCard
          label={t("invoiceAmount")}
          value={formatVndLocale(line?.finalAmount ?? "0", locale)}
          detail={`${formatNumberLocale(Number(metadata.tenantKwh ?? 0), locale)} kWh × ${formatVndLocale(String(metadata.applicableRate ?? 0), locale)} / kWh`}
          icon={<Receipt />}
        />
      </div>
      <section className="invoice-calculation-block">
        <h3>{t("calculation")}</h3>
        <p>
          {formatNumberLocale(Number(metadata.tenantKwh ?? 0), locale)} kWh ×{" "}
          {formatVndLocale(String(metadata.applicableRate ?? 0), locale)}/kWh
        </p>
        <div>
          <span>{t("calculatedAmount")}</span>
          <strong>{formatVndLocale(line.calculatedAmount, locale)}</strong>
        </div>
        <div>
          <span>{t("finalBilledAmount")}</span>
          <strong>{formatVndLocale(line.finalAmount, locale)}</strong>
        </div>
        {line.isOverridden && (
          <div>
            <span>{t("overrideReason")}</span>
            <strong>{line.overrideReason ?? "—"}</strong>
          </div>
        )}
      </section>
      <section className="attribution-inline">
        <h3>{t("usageAttribution")}</h3>
        <div>
          <span>{t("thisInvoice")}</span>
          <strong>{metadata.tenantKwh == null ? t("unknown") : `${formatNumberLocale(Number(metadata.tenantKwh), locale)} kWh`}</strong>
        </div>
        <div>
          <span>{t("otherTenancy")}</span>
          <strong>{metadata.otherTenancyUsage == null ? t("unknown") : `${formatNumberLocale(Number(metadata.otherTenancyUsage), locale)} kWh`}</strong>
        </div>
        <div>
          <span>{t("vacantProperty")}</span>
          <strong>{metadata.vacantUsage == null ? t("unknown") : `${formatNumberLocale(Number(metadata.vacantUsage), locale)} kWh`}</strong>
        </div>
      </section>
      <p className="billing-explainer">
        {t("physicalAllocationExplainer")}
      </p>
      <h3>{t("physicalMeterEvidence")}</h3>
      <div className="utility-table-wrap">
        <table className="utility-table">
          <thead>
            <tr>
              <th>{t("physicalMeter")}</th>
              <th>{t("previousAnchor")}</th>
              <th>{t("monthlyClosing")}</th>
              <th>{t("billingEndBoundary")}</th>
              <th>{t("closingUsage")}</th>
              <th>{t("knownUsage")}</th>
              <th>{t("evidence")}</th>
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
                    <strong>{String(meter.meterNumber ?? t("unnumbered"))}</strong>
                  </td>
                  <td>
                    {opening
                      ? `${opening.value} kWh · ${formatDateOnlyLocale(String(opening.date), locale)} · ${readingLabel(opening, t)}`
                      : "—"}
                  </td>
                  <td>
                    {monthlyClosing
                      ? `${monthlyClosing.value} kWh · ${formatDateOnlyLocale(String(monthlyClosing.date), locale)}`
                      : "—"}
                  </td>
                  <td>
                    {closing
                      ? `${closing.value} kWh · ${formatDateOnlyLocale(String(closing.date), locale)} · ${readingLabel(closing, t)}`
                      : "—"}
                  </td>
                  <td>{String(meter.usage ?? 0)} kWh</td>
                  <td>{String(meter.knownUsage ?? meter.usage ?? 0)} kWh</td>
                  <td>
                    {meter.hasEstimatedReading ? (
                      <BillingStatusBadge status="ESTIMATED" />
                    ) : (
                      t("measured")
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
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  if (invoice.status === "DRAFT")
    return (
      <Empty
        title={t("paymentsUnavailableDraft")}
        description={t("finalizeBeforePayment")}
      />
    );
  return (
    <>
      <div className="evidence-summary service-summary">
        <ContextCard
          label={t("invoiceTotal")}
          value={formatVndLocale(invoice.total, locale)}
          detail={t("finalBilledValue")}
        />
        <ContextCard
          label={t("paid")}
          value={formatVndLocale(invoice.totalPaid, locale)}
          detail={t("paymentRecords", { count: invoice.payments.length })}
        />
        <ContextCard
          label={t("balance")}
          value={formatVndLocale(invoice.balance, locale)}
          detail={paymentStatusLabel(invoice.paymentStatus, t)}
        />
      </div>
      <div className="section-heading-row">
        <div>
          <h3>{t("paymentHistory")}</h3>
          <p className="utility-subtle">
            {t("paymentsHistorySubtitle")}
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
                <th>{t("date")}</th>
                <th>{t("method")}</th>
                <th>{t("amount")}</th>
                <th>{t("reference")}</th>
                <th>{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDateOnlyLocale(payment.paymentDate, locale)}</td>
                  <td>
                    {payment.isDepositApplication
                      ? t("depositApplied")
                      : paymentMethodLabel(payment.method, t)}
                  </td>
                  <td>
                    <strong>{formatVndLocale(payment.amount, locale)}</strong>
                  </td>
                  <td>
                    {payment.isDepositApplication
                      ? t("depositAppliedDetail")
                      : (payment.reference ?? "—")}
                  </td>
                  <td>
                    {payment.isDepositApplication ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link href="/billing/deposits">{t("viewDeposit")}</Link>
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
          title={t("noPaymentInvoice")}
          description={t("noPaymentInvoiceDetail")}
        />
      )}
    </>
  );
}

function HistoryTab({ invoice }: { invoice: Invoice }) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const events = [
    {
      date: invoice.createdAt,
      title:
        invoice.type === "FINAL_SETTLEMENT"
          ? t("finalSettlementGenerated")
          : t("draftCreated"),
      detail:
        invoice.type === "FINAL_SETTLEMENT"
          ? t("moveOutObligationsCaptured")
          : t("invoiceSnapshot"),
    },
    ...(invoice.type === "FINAL_SETTLEMENT"
      ? [
          {
            date: invoice.createdAt,
            title: t("moveOutBoundaryUsed"),
            detail: formatDateOnlyLocale(invoice.invoiceDate, locale),
          },
        ]
      : []),
    ...invoice.lines
      .filter((line) => line.isOverridden)
      .map((line) => ({
        date: line.updatedAt,
        title: t("lineOverridden", { type: chargeTypeLabel(line.type, t) }),
        detail: line.overrideReason ?? t("finalAmountChanged"),
      })),
    ...invoice.adjustments.map((adjustment) => ({
      date: adjustment.createdAt,
      title: t("adjustmentAdded"),
      detail: `${adjustment.description} · ${adjustment.type === "CREDIT" ? "−" : ""}${formatVndLocale(adjustment.amount, locale)}`,
    })),
    ...(invoice.finalizedAt
      ? [
          {
            date: invoice.finalizedAt,
            title: t("invoiceFinalized"),
            detail: t("snapshotImmutable"),
          },
        ]
      : []),
    ...invoice.payments.map((payment) => ({
      date: payment.createdAt,
      title: payment.isDepositApplication
        ? t("depositApplied")
        : t("paymentRecorded"),
      detail: `${formatVndLocale(payment.amount, locale)} · ${payment.reference ?? paymentMethodLabel(payment.method, t)}`,
    })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());
  return (
    <div className="billing-timeline">
      {events.map((event, index) => (
        <div key={`${event.title}-${index}`}>
          <span />
          <time>{formatDateOnlyLocale(event.date, locale)}</time>
          <strong>{event.title}</strong>
          <p>{event.detail}</p>
        </div>
      ))}
    </div>
  );
}

function InvoicePreviewDialog({ invoice }: { invoice: Invoice }) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const presentation = invoicePresentation(invoice, locale);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Eye /> {t("previewInvoice")}
        </Button>
      </DialogTrigger>
      <DialogContent className="invoice-preview-dialog">
        <DialogHeader>
          <DialogTitle>{t("invoicePreview")}</DialogTitle>
          <DialogDescription>
            {invoice.status === "DRAFT"
              ? t("draftPreview")
              : t("finalizedCanonicalInvoice")}
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
                <span>{t("rentalUtilitiesManagement")}</span>
              </div>
            </div>
            <div className="invoice-paper-heading">
              <h2>{presentation.documentTitle}</h2>
              <p>#{presentation.invoiceNumber}</p>
              {presentation.isDraft && (
                <span className="invoice-paper-draft">{t("draftWatermark")}</span>
              )}
            </div>
          </header>

          <dl className="invoice-paper-details">
            <div>
              <dt>{t("billTo")}</dt>
              <dd>{presentation.billTo}</dd>
            </div>
            <div>
              <dt>{t("invoicePaperRoom")}</dt>
              <dd>{presentation.room}</dd>
            </div>
            <div>
              <dt>{presentation.billingLabel}</dt>
              <dd>{presentation.billingValue}</dd>
            </div>
          </dl>

          <div className="invoice-paper-table-heading">
            <span>{t("lineItem")}</span>
            <span>{t("detailCalculation")}</span>
            <span>{t("quantityUsage")}</span>
            <span>{t("rate")}</span>
            <span>{t("lineAmount")}</span>
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
              <span>{t("totalPayment")}</span>
              <strong>{formatVndLocale(presentation.total, locale)}</strong>
            </div>
          </div>

          <footer className="invoice-paper-footer">
            <div>
              <strong>{presentation.propertyName}</strong>
              <span>
                {presentation.isDraft
                  ? t("draftPreviewFooter")
                  : t("finalizedInvoiceFooter")}
              </span>
            </div>
            <p>
              {t("electronicInvoiceCreated")}
              <br />
              {t("thankYouOnTime")}
            </p>
          </footer>
        </article>
        {invoice.status === "FINALIZED" && (
          <DialogFooter>
            <Button onClick={() => exportInvoicePng(invoice, locale)}>
              <Download /> {t("downloadPng")}
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
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const [state, action] = React.useActionState(
    overrideInvoiceLineAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil /> {t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editCharge", { type: chargeTypeLabel(line.type, t) })}</DialogTitle>
          <DialogDescription>
            Calculated {formatVndLocale(line.calculatedAmount, locale)}. The original
            calculation remains preserved.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="lineId" value={line.id} />
          <Field
            label={t("finalAmount")}
            name="finalAmount"
            type="number"
            step="10"
            defaultValue={line.finalAmount}
            required
          />
          <Field
            label={t("overrideReason")}
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
            <Button type="submit">{t("saveCharge")}</Button>
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
  const t = useTranslations("billing");
  const [state, action] = React.useActionState(
    adjustment ? updateInvoiceAdjustmentAction : addInvoiceAdjustmentAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={adjustment ? "ghost" : "outline"}>
          {adjustment ? <Pencil /> : <Plus />}
          {adjustment ? t("edit") : t("addAdjustment")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {adjustment ? t("editAdjustment") : t("addAdjustment")}
          </DialogTitle>
          <DialogDescription>
            {t("addAdjustmentDescription")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          {adjustment && (
            <input type="hidden" name="adjustmentId" value={adjustment.id} />
          )}
          <div className="field">
            <Label>{t("type")}</Label>
            <select name="type" defaultValue={adjustment?.type ?? "CHARGE"}>
              <option value="CHARGE">{t("additionalCharge")}</option>
              <option value="CREDIT">{t("creditDiscount")}</option>
            </select>
          </div>
          <Field
            label={t("description")}
            name="description"
            defaultValue={adjustment?.description ?? ""}
            required
          />
          <Field
            label={t("amount")}
            name="amount"
            type="number"
            min="1"
            step="1"
            defaultValue={adjustment?.amount ?? ""}
            required
          />
          <Field
            label={t("reasonOptional")}
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
              {adjustment ? t("saveAdjustment") : t("addAdjustment")}
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
  const t = useTranslations("billing");
  const [state, action] = React.useActionState(
    deleteInvoiceAdjustmentAction,
    emptyActionState,
  );
  return (
    <form action={action} className="billing-inline-form">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="adjustmentId" value={adjustmentId} />
      <Button size="sm" variant="ghost" aria-label={t("removeAdjustment")}>
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
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const [state, action] = React.useActionState(
    recordPaymentAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus /> {t("recordPayment")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recordPayment")}</DialogTitle>
          <DialogDescription>
            {invoice.room} · {formatMonthLocale(invoice.billingPeriod, locale)} ·{" "}
            {invoice.renterName}
          </DialogDescription>
        </DialogHeader>
        <div className="payment-dialog-summary">
          <Info label={t("invoiceTotal")} value={formatVndLocale(invoice.total, locale)} />
          <Info label={t("paid")} value={formatVndLocale(invoice.totalPaid, locale)} />
          <Info label={t("remaining")} value={formatVndLocale(invoice.balance, locale)} />
        </div>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <div className="dialog-grid">
            <Field
              label={t("amount")}
              name="amount"
              type="number"
              step="1"
              max={invoice.balance}
              defaultValue={invoice.balance}
              required
            />
            <Field
              label={t("date")}
              name="paymentDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <SelectMethod defaultValue="CASH" />
          <Field label={t("reference")} name="reference" />
          <Field label={t("notes")} name="notes" />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">{t("recordPayment")}</Button>
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
  const t = useTranslations("billing");
  const [state, action] = React.useActionState(
    updatePaymentAction,
    emptyActionState,
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil /> {t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editPayment")}</DialogTitle>
          <DialogDescription>
            {t("updatePaymentDescription")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="paymentId" value={payment.id} />
          <div className="dialog-grid">
            <Field
              label={t("amount")}
              name="amount"
              type="number"
              step="1"
              defaultValue={payment.amount}
              required
            />
            <Field
              label={t("date")}
              name="paymentDate"
              type="date"
              defaultValue={payment.paymentDate.toISOString().slice(0, 10)}
              required
            />
          </div>
          <SelectMethod defaultValue={payment.method} />
          <Field
            label={t("reference")}
            name="reference"
            defaultValue={payment.reference ?? ""}
          />
          <Field
            label={t("notes")}
            name="notes"
            defaultValue={payment.notes ?? ""}
          />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">{t("savePayment")}</Button>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeButton({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("billing");
  const [state, action] = React.useActionState(
    finalizeInvoiceAction,
    emptyActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button>{t("finalize")}</Button>
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
  const t = useTranslations("billing");
  return (
    <div className="field">
      <Label>{t("method")}</Label>
      <select name="method" defaultValue={defaultValue}>
        <option value="CASH">{t("cash")}</option>
        <option value="BANK_TRANSFER">{t("bankTransfer")}</option>
        <option value="OTHER">{t("other")}</option>
      </select>
    </div>
  );
}
function tabLabel(value: Tab, t: ReturnType<typeof useTranslations<"billing">>) {
  return ({ charges: t("charges"), services: t("services"), electricity: t("electricity"), payments: t("payments"), history: t("history") })[value];
}
function chargeTypeLabel(value: string, t: ReturnType<typeof useTranslations<"billing">>) {
  return ({ RENT: t("rent"), ELECTRICITY: t("electricity"), WATER: t("water"), ADJUSTMENT: t("adjustmentLabel") } as Record<string,string>)[value] ?? value.toLowerCase().replaceAll("_", " ");
}
function roleLabel(value: string, t: ReturnType<typeof useTranslations<"billing">>) {
  if (value === "RESPONSIBLE") return t("responsibleRenter");
  return value.toLowerCase().replaceAll("_", " ");
}
function paymentStatusLabel(value: string, t: ReturnType<typeof useTranslations<"billing">>) {
  return ({ PAID: t("paid"), PARTIAL: t("partial"), UNPAID: t("unpaid") } as Record<string,string>)[value] ?? value.toLowerCase();
}
function paymentMethodLabel(value: string, t: ReturnType<typeof useTranslations<"billing">>) {
  if (value === "CASH") return t("cash");
  if (value === "BANK_TRANSFER") return t("bankTransfer");
  return t("other");
}
function chargeDetail(
  type: string,
  metadata: unknown,
  t: ReturnType<typeof useTranslations<"billing">>,
  locale: AppLocale,
) {
  const item = metadata as Record<string, unknown>;
  if (type === "RENT")
    return item.fullMonth
      ? t("rentDetail", { amount: formatVndLocale(String(item.monthlyRentVnd ?? 0), locale) })
      : t("rentProratedDetail", { amount: formatVndLocale(String(item.monthlyRentVnd ?? 0), locale), days: Number(item.billableDays ?? 0) });
  if (type === "ELECTRICITY")
    return t("electricityDetail", { kwh: formatNumberLocale(Number(item.tenantKwh ?? 0), locale), rate: formatVndLocale(String(item.applicableRate ?? 0), locale) });
  const occupants = Array.isArray(item.occupants)
    ? (item.occupants as Array<Record<string, unknown>>)
    : [];
  return occupants.map((person) => t("personStay", {
    name: String(person.personName ?? ""),
    duration: person.fullMonth ? t("fullMonth") : t("daysCount", { count: Number(person.billableDays ?? 0) }),
  })).join(" · ") || t("noBillableOccupants");
}
function readingLabel(reading: Record<string, unknown>, t: ReturnType<typeof useTranslations<"billing">>) {
  const labels: Record<string, string> = {
    MANUAL: t("manualReading"),
    MONTHLY: t("legacyMonthlyReading"),
    MOVE_IN: t("moveIn"),
    MOVE_OUT: t("moveOut"),
    METER_INSTALL: t("meterInstalled"),
    METER_REMOVAL: t("meterRemoved"),
  };
  return labels[String(reading.type ?? "")] ?? String(reading.type ?? "reading").toLowerCase().replaceAll("_", " ");
}
