"use client";

import * as React from "react";
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
import { formatDate, formatVnd } from "@/lib/presentation";
import { depositTransactionAction } from "../actions";
import type { getDepositOverview } from "../server/deposit.queries";
import { BillingStatusBadge } from "./billing-status";
import { monthLabel } from "./invoice-export";

type Overview = Awaited<ReturnType<typeof getDepositOverview>>;
type Deposit = Overview["items"][number];
type Kind = "RECEIPT" | "DEDUCTION" | "REFUND" | "APPLIED_TO_INVOICE";

export function DepositsDashboard({ overview }: { overview: Overview }) {
  const { items, summary } = overview;
  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">TENANCY FUNDS</p>
          <h1>Deposits</h1>
          <p>
            Track expected, received, held, and explicitly settled deposits.
          </p>
        </div>
      </header>
      <section className="summary-grid billing-summary">
        <Card
          label="Expected"
          value={formatVnd(summary.expected)}
          detail={`${items.length} tenancy records`}
          icon={<CircleDollarSign />}
        />
        <Card
          label="Received"
          value={formatVnd(summary.received)}
          detail="All deposit receipts"
          icon={<HandCoins />}
        />
        <Card
          label="Currently held"
          value={formatVnd(summary.held)}
          detail="Available for settlement"
          icon={<WalletCards />}
        />
        <Card
          label="Needs settlement"
          value={`${summary.needsSettlement} deposits`}
          detail="Former tenancies with held funds"
          icon={<HandCoins />}
        />
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Deposit ledger</h2>
            <p>
              Deposit funds remain separate from billed and collected rental
              revenue.
            </p>
          </div>
        </div>
        {items.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Room</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Held</th>
                  <th>Deductions</th>
                  <th>Applied to invoices</th>
                  <th>Refunded</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((deposit) => (
                  <tr key={deposit.tenancyId}>
                    <td>
                      <strong>{deposit.tenantName}</strong>
                    </td>
                    <td>{deposit.room}</td>
                    <td>{formatVnd(deposit.expected)}</td>
                    <td>{formatVnd(deposit.received)}</td>
                    <td>
                      <strong>{formatVnd(deposit.held)}</strong>
                    </td>
                    <td>{formatVnd(deposit.deductions)}</td>
                    <td>{formatVnd(deposit.applied)}</td>
                    <td>{formatVnd(deposit.refunded)}</td>
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
            <strong>No deposits</strong>
            <p>No expected deposits or ledger transactions are available.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function DepositDetail({ deposit }: { deposit: Deposit }) {
  const held = Number(deposit.held);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <WalletCards /> Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="billing-detail-dialog">
        <DialogHeader>
          <DialogTitle>
            {deposit.tenantName} · {deposit.room}
          </DialogTitle>
          <DialogDescription>
            Deposit position, settlement options, and ledger history.
          </DialogDescription>
        </DialogHeader>
        <div className="deposit-detail-grid deposit-settlement-summary">
          <Info label="Deposit received" value={formatVnd(deposit.received)} />
          <Info
            label="Applied to invoices"
            value={formatVnd(deposit.applied)}
          />
          <Info
            label="Direct deductions"
            value={formatVnd(deposit.deductions)}
          />
          <Info label="Refunded" value={formatVnd(deposit.refunded)} />
          <Info label="Remaining held" value={formatVnd(deposit.held)} />
          <Info label="Status" value={title(deposit.status)} />
        </div>
        <div className="billing-actions">
          <DepositAction
            deposit={deposit}
            kind="RECEIPT"
            label="Record receipt"
          />
          {held > 0 && (
            <>
              <DepositAction
                deposit={deposit}
                kind="DEDUCTION"
                label="Add deduction"
              />
              <DepositAction deposit={deposit} kind="REFUND" label="Refund" />
            </>
          )}
          {held > 0 && deposit.invoices.length > 0 && (
            <DepositAction
              deposit={deposit}
              kind="APPLIED_TO_INVOICE"
              label="Apply to invoice"
            />
          )}
        </div>
        <section className="deposit-history">
          <div className="section-heading-row">
            <div>
              <h3>Settlement activity</h3>
              <p className="utility-subtle">
                Every balance change is represented by a ledger entry.
              </p>
            </div>
          </div>
          {deposit.history.length ? (
            <div className="utility-table-wrap">
              <table className="utility-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Held after</th>
                  </tr>
                </thead>
                <tbody>
                  {deposit.history.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.transactionDate)}</td>
                      <td>{title(item.type)}</td>
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
                              View invoice
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
                        {formatVnd(item.amount)}
                      </td>
                      <td>{formatVnd(item.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="billing-empty">
              <strong>No deposit history</strong>
              <p>No deposit transactions have been recorded yet.</p>
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
            <Info label="Held deposit" value={formatVnd(deposit.held)} />
            <Info
              label="Invoice balance"
              value={formatVnd(invoice?.balance ?? "0")}
            />
          </div>
        )}
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="tenancyId" value={deposit.tenancyId} />
          <input type="hidden" name="kind" value={kind} />
          <div className="dialog-grid">
            <div className="field">
              <Label>Amount</Label>
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
              label="Date"
              name="transactionDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          {kind === "DEDUCTION" && (
            <div className="field">
              <Label>Category</Label>
              <select name="category">
                <option value="DAMAGE">Damage</option>
                <option value="CLEANING">Cleaning</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}
          {kind === "APPLIED_TO_INVOICE" && (
            <>
              <div className="field">
                <Label>Outstanding invoice</Label>
                <select
                  name="invoiceId"
                  value={invoiceId}
                  onChange={(event) => setInvoiceId(event.target.value)}
                  required
                >
                  {deposit.invoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.room} · {monthLabel(item.billingPeriod)} · balance{" "}
                      {formatVnd(item.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="resulting-balances">
                <Info
                  label="Invoice balance after"
                  value={formatVnd(
                    String(
                      Math.max(
                        0,
                        Number(invoice?.balance ?? 0) - numericAmount,
                      ),
                    ),
                  )}
                />
                <Info
                  label="Deposit held after"
                  value={formatVnd(
                    String(Math.max(0, Number(deposit.held) - numericAmount)),
                  )}
                />
              </div>
            </>
          )}
          <Field label="Reference" name="reference" />
          <div className="field">
            <Label>Notes</Label>
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
function title(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}
