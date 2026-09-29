"use client";

import * as React from "react";
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
import { formatDate, formatVnd } from "@/lib/presentation";
import { MonthSelector } from "@/modules/utilities/components/utility-ui";
import { updatePaymentAction } from "../actions";
import type {
  getFinancialSummary,
  getPayments,
} from "../server/payment.queries";
import { BillingStatusBadge } from "./billing-status";
import { monthLabel } from "./invoice-export";

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
          <p className="utilities-eyebrow">COLLECTIONS</p>
          <h1>Payments</h1>
          <p>
            See when revenue was billed, when cash arrived, and what remains
            outstanding.
          </p>
        </div>
        <MonthSelector month={month} />
      </header>
      <section className="summary-grid billing-summary">
        <Card
          label="Billed revenue"
          value={formatVnd(summary.billed)}
          detail="Invoice billing period"
          icon={<CircleDollarSign />}
        />
        <Card
          label="Cash collected"
          value={formatVnd(summary.collected)}
          detail="Payment date · excludes deposits"
          icon={<Banknote />}
        />
        <Card
          label="Outstanding"
          value={formatVnd(summary.outstanding)}
          detail="Finalized invoice balance"
          icon={<WalletCards />}
        />
        <Card
          label="Open invoices"
          value={`${summary.partial + summary.unpaid} open`}
          detail={`${summary.partial} partial · ${summary.unpaid} unpaid`}
          icon={<CircleDollarSign />}
        />
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Outstanding invoices</h2>
            <p>Finalized invoices that still have a balance.</p>
          </div>
        </div>
        {summary.outstandingInvoices.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Room</th>
                  <th>Invoice / Month</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Action</th>
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
                        ? "Final settlement"
                        : monthLabel(invoice.billingPeriod)}
                    </td>
                    <td>
                      <strong>{formatVnd(invoice.balance)}</strong>
                    </td>
                    <td>
                      <BillingStatusBadge status={invoice.paymentStatus} />
                    </td>
                    <td>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/billing/invoices/${invoice.id}`}>
                          View invoice
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
            <strong>No outstanding invoices</strong>
            <p>All finalized invoices are fully settled.</p>
          </div>
        )}
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Payment activity</h2>
            <p>
              Transactions recorded during{" "}
              {new Intl.DateTimeFormat("en", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${month}-01T00:00:00Z`))}
              .
            </p>
          </div>
          {summary.unpaid + summary.partial > 0 && (
            <Button asChild variant="outline">
              <Link href={`/billing/invoices?month=${month}`}>
                View unpaid invoices
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
              placeholder="Search tenant, room, invoice, reference"
            />
          </label>
          <select
            aria-label="Payment method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="ALL">All methods</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            aria-label="Payment source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="ALL">All sources</option>
            <option value="PAYMENT">Direct payment</option>
            <option value="DEPOSIT">Tenant deposit</option>
          </select>
        </div>
        {filtered.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tenant</th>
                  <th>Invoice</th>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paymentDate)}</td>
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
                            ? "Final settlement"
                            : monthLabel(payment.billingPeriod)}
                        </span>
                      </div>
                    </td>
                    <td>
                      {payment.isDepositApplication
                        ? "Tenant deposit"
                        : title(payment.method)}
                    </td>
                    <td>
                      <strong>{formatVnd(payment.amount)}</strong>
                    </td>
                    <td>
                      {payment.isDepositApplication ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link href="/billing/deposits">View deposit</Link>
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
            <strong>No payments</strong>
            <p>No payments recorded for this month or filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function EditPayment({ payment }: { payment: Payments[number] }) {
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
            {payment.invoiceLabel} · {payment.room} · {payment.renterName}
          </DialogDescription>
        </DialogHeader>
        <div className="payment-dialog-summary">
          <Info label="Invoice total" value={formatVnd(payment.invoiceTotal)} />
          <Info label="Total paid" value={formatVnd(payment.totalPaid)} />
          <Info label="Balance" value={formatVnd(payment.balance)} />
        </div>
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
              label="Payment date"
              name="paymentDate"
              type="date"
              defaultValue={payment.paymentDate.toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="field">
            <Label>Method</Label>
            <select name="method" defaultValue={payment.method}>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
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
function title(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}
