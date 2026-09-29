"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { CircleDollarSign, HandCoins, WalletCards } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState } from "@/lib/action-state";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthLocale, formatVndLocale } from "@/i18n/format";
import { depositTransactionAction } from "../actions";
import type { getDepositOverview } from "../server/deposit.queries";
import { BillingStatusBadge } from "./billing-status";


type Overview = Awaited<ReturnType<typeof getDepositOverview>>;
type Deposit = Overview["items"][number];
type Kind = "RECEIPT" | "DEDUCTION" | "REFUND" | "APPLIED_TO_INVOICE";

export function DepositsDashboard({ overview }: { overview: Overview }) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const { items, summary } = overview;
  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">{t("tenancyFunds")}</p>
          <h1>{t("deposits")}</h1>
<p>{t("depositsSubtitle")}</p>
        </div>
      </header>
      <section className="summary-grid billing-summary">
        <Card
          label={t("expected")}
          value={formatVndLocale(summary.expected, locale)}
          detail={t("tenancyRecords", { count: items.length })}
          icon={<CircleDollarSign />}
        />
        <Card
          label={t("received")}
          value={formatVndLocale(summary.received, locale)}
          detail={t("allReceipts")}
          icon={<HandCoins />}
        />
        <Card
          label={t("currentlyHeld")}
          value={formatVndLocale(summary.held, locale)}
          detail={t("availableSettlement")}
          icon={<WalletCards />}
        />
        <Card
          label={t("needsSettlement")}
          value={t("needsSettlementCount", { count: summary.needsSettlement })}
          detail={t("formerHeld")}
          icon={<HandCoins />}
        />
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("depositLedger")}</h2>
<p>{t("depositLedgerSubtitle")}</p>
          </div>
        </div>
        {items.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>{t("tenant")}</th>
                  <th>{t("room")}</th>
                  <th>{t("expected")}</th>
                  <th>{t("received")}</th>
                  <th>{t("held")}</th>
                  <th>{t("deductions")}</th>
                  <th>{t("appliedInvoices")}</th>
                  <th>{t("refunded")}</th>
                  <th>{t("status")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((deposit) => (
                  <tr key={deposit.tenancyId}>
                    <td>
                      <strong>{deposit.tenantName}</strong>
                    </td>
                    <td>{deposit.room}</td>
                    <td>{formatVndLocale(deposit.expected, locale)}</td>
                    <td>{formatVndLocale(deposit.received, locale)}</td>
                    <td>
                      <strong>{formatVndLocale(deposit.held, locale)}</strong>
                    </td>
                    <td>{formatVndLocale(deposit.deductions, locale)}</td>
                    <td>{formatVndLocale(deposit.applied, locale)}</td>
                    <td>{formatVndLocale(deposit.refunded, locale)}</td>
                    <td>
                      <BillingStatusBadge status={deposit.status} />
                    </td>
                    <td>
                      <DepositDetail deposit={deposit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="billing-empty">
            <strong>{t("noDeposits")}</strong>
            <p>{t("noDepositsDetail")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function DepositDetail({ deposit }: { deposit: Deposit }) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const held = Number(deposit.held);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <WalletCards /> {t("manage")}
        </Button>
      </DialogTrigger>
      <DialogContent className="billing-detail-dialog">
        <DialogHeader>
          <DialogTitle>
            {deposit.tenantName} · {deposit.room}
          </DialogTitle>
          <DialogDescription>
            {t("depositPosition")}
          </DialogDescription>
        </DialogHeader>
        <div className="deposit-detail-grid deposit-settlement-summary">
          <Info label={t("depositReceivedLabel")} value={formatVndLocale(deposit.received, locale)} />
          <Info
            label={t("appliedInvoices")}
            value={formatVndLocale(deposit.applied, locale)}
          />
          <Info
            label={t("directDeductions")}
            value={formatVndLocale(deposit.deductions, locale)}
          />
          <Info label={t("refunded")} value={formatVndLocale(deposit.refunded, locale)} />
          <Info label={t("remainingHeld")} value={formatVndLocale(deposit.held, locale)} />
          <Info label={t("status")} value={depositStatusLabel(deposit.status, t)} />
        </div>
        <div className="billing-actions">
          <DepositAction
            deposit={deposit}
            kind="RECEIPT"
            label={t("recordReceipt")}
          />
          {held > 0 && (
            <>
              <DepositAction
                deposit={deposit}
                kind="DEDUCTION"
                label={t("addDeduction")}
              />
              <DepositAction deposit={deposit} kind="REFUND" label={t("refund")} />
            </>
          )}
          {held > 0 && deposit.invoices.length > 0 && (
            <DepositAction
              deposit={deposit}
              kind="APPLIED_TO_INVOICE"
              label={t("applyInvoice")}
            />
          )}
        </div>
        <section className="deposit-history">
          <div className="section-heading-row">
            <div>
              <h3>{t("settlementActivity")}</h3>
              <p className="utility-subtle">
                {t("ledgerEntryHelp")}
              </p>
            </div>
          </div>
          {deposit.history.length ? (
            <div className="utility-table-wrap">
              <table className="utility-table">
                <thead>
                  <tr>
                    <th>{t("date")}</th>
                    <th>{t("type")}</th>
                    <th>{t("description")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("heldAfter")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deposit.history.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateOnlyLocale(item.transactionDate, locale)}</td>
                      <td>{depositTransactionLabel(item.type, t)}</td>
                      <td>
                        {item.description}
                        {item.reference && (
                          <div className="utility-subtle">{item.reference}</div>
                        )}
                        {item.invoice && (
                          <div>
                            <Link
                              className="billing-table-link"
                              href={`/billing/invoices/${item.invoice.id}`}
                            >
                              {t("viewInvoice")}
                            </Link>
                          </div>
                        )}
                      </td>
                      <td
                        className={
                          item.effect.startsWith("+")
                            ? "deposit-positive"
                            : "deposit-negative"
                        }
                      >
                        {item.effect.startsWith("+") ? "+" : "−"}
                        {formatVndLocale(item.amount, locale)}
                      </td>
                      <td>{formatVndLocale(item.balanceAfter, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="billing-empty">
              <strong>{t("noDepositHistory")}</strong>
              <p>{t("noDepositHistoryDetail")}</p>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function DepositAction({
  deposit,
  kind,
  label,
}: {
  deposit: Deposit;
  kind: Kind;
  label: string;
}) {
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
  const [state, action] = React.useActionState(
    depositTransactionAction,
    emptyActionState,
  );
  const [invoiceId, setInvoiceId] = React.useState(
    deposit.invoices[0]?.id ?? "",
  );
  const [amount, setAmount] = React.useState("");
  const invoice = deposit.invoices.find((item) => item.id === invoiceId);
  const numericAmount = Number(amount || 0);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={kind === "RECEIPT" ? "default" : "outline"}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {deposit.tenantName} · {deposit.room}
          </DialogDescription>
        </DialogHeader>
        {kind === "APPLIED_TO_INVOICE" && (
          <div className="payment-dialog-summary">
            <Info label={t("heldDeposit")} value={formatVndLocale(deposit.held, locale)} />
            <Info
              label={t("invoiceBalance")}
              value={formatVndLocale(invoice?.balance ?? "0", locale)}
            />
          </div>
        )}
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="tenancyId" value={deposit.tenancyId} />
          <input type="hidden" name="kind" value={kind} />
          <div className="dialog-grid">
            <div className="field">
              <Label>{t("amount")}</Label>
              <Input
                name="amount"
                type="number"
                step="1"
                max={
                  kind === "RECEIPT"
                    ? undefined
                    : kind === "APPLIED_TO_INVOICE"
                      ? Math.min(
                          Number(deposit.held),
                          Number(invoice?.balance ?? 0),
                        )
                      : deposit.held
                }
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <Field
              label={t("date")}
              name="transactionDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          {kind === "DEDUCTION" && (
            <div className="field">
              <Label>{t("category")}</Label>
              <select name="category">
                <option value="DAMAGE">{t("damage")}</option>
                <option value="CLEANING">{t("cleaning")}</option>
                <option value="OTHER">{t("other")}</option>
              </select>
            </div>
          )}
          {kind === "APPLIED_TO_INVOICE" && (
            <>
              <div className="field">
                <Label>{t("outstandingInvoice")}</Label>
                <select
                  name="invoiceId"
                  value={invoiceId}
                  onChange={(event) => setInvoiceId(event.target.value)}
                  required
                >
                  {deposit.invoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.room} · {formatMonthLocale(item.billingPeriod, locale)} · {t("balance")} {formatVndLocale(item.balance, locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="resulting-balances">
                <Info
                  label={t("invoiceBalanceAfter")}
                  value={formatVndLocale(
                    String(
                      Math.max(
                        0,
                        Number(invoice?.balance ?? 0) - numericAmount,
                      ),
                    ),
                    locale,
                  )}
                />
                <Info
                  label={t("depositHeldAfter")}
                  value={formatVndLocale(
                    String(Math.max(0, Number(deposit.held) - numericAmount)),
                    locale,
                  )}
                />
              </div>
            </>
          )}
          <Field label={t("reference")} name="reference" />
          <div className="field">
            <Label>{t("notes")}</Label>
            <Textarea name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">{label}</Button>
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
function depositStatusLabel(value: string, t: ReturnType<typeof useTranslations<"billing">>) {
  if (value === "HELD") return t("held");
  if (value === "NEEDS_SETTLEMENT") return t("needsSettlement");
  return value.toLowerCase().replaceAll("_", " ");
}
function depositTransactionLabel(value: string, t: ReturnType<typeof useTranslations<"billing">>) {
  return ({ RECEIPT: t("recordReceipt"), DEDUCTION: t("deductions"), REFUND: t("refund"), APPLIED_TO_INVOICE: t("appliedInvoices") } as Record<string,string>)[value] ?? value;
}
