"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  Banknote,
  CircleDollarSign,
  Pencil,
  Search,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyActionState } from "@/lib/action-state";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthLocale, formatVndLocale } from "@/i18n/format";
import { MonthSelector } from "@/modules/utilities/components/utility-ui";
import { updatePaymentAction } from "../actions";
import type {
  getFinancialSummary,
  getPayments,
} from "../server/payment.queries";
import { BillingStatusBadge } from "./billing-status";


type Payments = Awaited<ReturnType<typeof getPayments>>;
type Summary = Awaited<ReturnType<typeof getFinancialSummary>>;

export function PaymentsDashboard({
  payments,
  summary,
  month,
}: {
  payments: Payments;
  summary: Summary;
  month: string;
}) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const [search, setSearch] = React.useState("");
  const [method, setMethod] = React.useState("ALL");
  const [source, setSource] = React.useState("ALL");
  const filtered = payments.filter((payment) => {
    const haystack =
      `${payment.renterName} ${payment.room} ${payment.reference ?? ""} ${payment.invoiceLabel}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (method === "ALL" || payment.method === method) &&
      (source === "ALL" ||
        (source === "DEPOSIT") === payment.isDepositApplication)
    );
  });
  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">{t("collections")}</p>
          <h1>{t("payments")}</h1>
<p>{t("paymentsSubtitle")}</p>
        </div>
        <MonthSelector month={month} />
      </header>
      <section className="summary-grid billing-summary">
        <Card
          label={t("billedRevenue")}
          value={formatVndLocale(summary.billed, locale)}
          detail={t("invoiceBillingPeriod")}
          icon={<CircleDollarSign />}
        />
        <Card
          label={t("cashCollected")}
          value={formatVndLocale(summary.collected, locale)}
          detail={t("paymentDateExcludesDeposits")}
          icon={<Banknote />}
        />
        <Card
          label={t("outstanding")}
          value={formatVndLocale(summary.outstanding, locale)}
          detail={t("finalizedBalance")}
          icon={<WalletCards />}
        />
        <Card
          label={t("openInvoices")}
          value={t("openInvoicesCount", { count: summary.partial + summary.unpaid })}
          detail={t("partialUnpaid", { partial: summary.partial, unpaid: summary.unpaid })}
          icon={<CircleDollarSign />}
        />
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("outstandingInvoices")}</h2>
            <p>{t("outstandingSubtitle")}</p>
          </div>
        </div>
        {summary.outstandingInvoices.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>{t("tenant")}</th>
                  <th>{t("room")}</th>
                  <th>{t("invoiceMonth")}</th>
                  <th>{t("balance")}</th>
                  <th>{t("status")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.outstandingInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.renterName}</strong>
                    </td>
                    <td>{invoice.room}</td>
                    <td>
                      {invoice.invoiceType === "FINAL_SETTLEMENT"
                        ? t("finalSettlement")
                        : formatMonthLocale(invoice.billingPeriod, locale)}
                    </td>
                    <td>
                      <strong>{formatVndLocale(invoice.balance, locale)}</strong>
                    </td>
                    <td>
                      <BillingStatusBadge status={invoice.paymentStatus} />
                    </td>
                    <td>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/billing/invoices/${invoice.id}`}>
                          {t("viewInvoice")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="billing-empty">
            <strong>{t("noOutstandingInvoices")}</strong>
            <p>{t("allSettled")}</p>
          </div>
        )}
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("paymentActivity")}</h2>
<p>{t("paymentActivityDuring", { month: formatMonthLocale(`${month}-01`, locale) })}</p>
          </div>
          {summary.unpaid + summary.partial > 0 && (
            <Button asChild variant="outline">
              <Link href={`/billing/invoices?month=${month}`}>
                {t("viewUnpaidInvoices")}
              </Link>
            </Button>
          )}
        </div>
        <div className="billing-toolbar">
          <label className="billing-search">
            <Search />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPayments")}
            />
          </label>
          <select
            aria-label={t("paymentMethod")}
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="ALL">{t("allMethods")}</option>
            <option value="CASH">{t("cash")}</option>
            <option value="BANK_TRANSFER">{t("bankTransfer")}</option>
            <option value="OTHER">{t("other")}</option>
          </select>
          <select
            aria-label={t("paymentSource")}
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="ALL">{t("allSources")}</option>
            <option value="PAYMENT">{t("directPayment")}</option>
            <option value="DEPOSIT">{t("tenantDeposit")}</option>
          </select>
        </div>
        {filtered.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>{t("date")}</th>
                  <th>{t("tenant")}</th>
                  <th>{t("invoice")}</th>
                  <th>{t("source")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateOnlyLocale(payment.paymentDate, locale)}</td>
                    <td>
                      <Link className="billing-table-link" href="/tenants">
                        {payment.renterName}
                      </Link>
                    </td>
                    <td>
                      <Link
                        className="billing-table-link"
                        href={`/billing/invoices/${payment.invoiceId}`}
                      >
                        <strong>{payment.invoiceLabel}</strong>
                      </Link>
                      <div>
                        <span className="utility-subtle">
                          {payment.room} ·{" "}
                          {payment.invoiceType === "FINAL_SETTLEMENT"
                            ? t("finalSettlement")
                            : formatMonthLocale(payment.billingPeriod, locale)}
                        </span>
                      </div>
                    </td>
                    <td>
                      {payment.isDepositApplication
                        ? t("tenantDeposit")
                        : paymentMethodLabel(payment.method, t)}
                    </td>
                    <td>
                      <strong>{formatVndLocale(payment.amount, locale)}</strong>
                    </td>
                    <td>
                      {payment.isDepositApplication ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link href="/billing/deposits">{t("viewDeposit")}</Link>
                        </Button>
                      ) : (
                        <EditPayment payment={payment} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="billing-empty">
            <strong>{t("noPayments")}</strong>
            <p>{t("noPaymentsFilter")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function EditPayment({ payment }: { payment: Payments[number] }) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
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
            {payment.invoiceLabel} · {payment.room} · {payment.renterName}
          </DialogDescription>
        </DialogHeader>
        <div className="payment-dialog-summary">
          <Info label={t("invoiceTotal")} value={formatVndLocale(payment.invoiceTotal, locale)} />
          <Info label={t("totalPaid")} value={formatVndLocale(payment.totalPaid, locale)} />
          <Info label={t("balance")} value={formatVndLocale(payment.balance, locale)} />
        </div>
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
              label={t("paymentDate")}
              name="paymentDate"
              type="date"
              defaultValue={payment.paymentDate.toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="field">
            <Label>{t("method")}</Label>
            <select name="method" defaultValue={payment.method}>
              <option value="CASH">{t("cash")}</option>
              <option value="BANK_TRANSFER">{t("bankTransfer")}</option>
              <option value="OTHER">{t("other")}</option>
            </select>
          </div>
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
function Card({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="utility-summary-card">
      <header>
        <span>{label}</span>
        {icon}
      </header>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
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
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function paymentMethodLabel(value: string, t: ReturnType<typeof useTranslations<"billing">>) {
  if (value === "CASH") return t("cash");
  if (value === "BANK_TRANSFER") return t("bankTransfer");
  return t("other");
}
