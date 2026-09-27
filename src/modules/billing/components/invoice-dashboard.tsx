"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileText, Layers3, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { formatDate, formatVnd } from "@/lib/presentation";
import { MonthSelector } from "@/modules/utilities/components/utility-ui";
import { generateAllReadyAction, generateInvoiceAction } from "../actions";
import type {
  getBillingCandidates,
  getInvoices,
} from "../server/billing.queries";
import { BillingStatusBadge } from "./billing-status";
import { exportInvoicePng, monthLabel } from "./invoice-export";

type Candidates = Awaited<ReturnType<typeof getBillingCandidates>>;
type Invoices = Awaited<ReturnType<typeof getInvoices>>;
type Filter = "ALL" | "DRAFT" | "FINALIZED" | "UNPAID" | "PARTIAL" | "PAID";

export function InvoiceDashboard({
  propertyId,
  month,
  candidates,
  invoices,
}: {
  propertyId: string;
  month: string;
  candidates: Candidates;
  invoices: Invoices;
}) {
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [selected, setSelected] = React.useState<string[]>([]);
  const ready = candidates.filter((item) => item.status === "READY").length;
  const drafts = invoices.filter(
    (invoice) => invoice.status === "DRAFT",
  ).length;
  const finalized = invoices.filter(
    (invoice) => invoice.status === "FINALIZED",
  );
  const outstanding = finalized.reduce(
    (sum, invoice) => sum + Number(invoice.balance),
    0,
  );
  const filtered = invoices.filter((invoice) => {
    if (filter === "ALL") return true;
    if (filter === "DRAFT" || filter === "FINALIZED")
      return invoice.status === filter;
    return invoice.status === "FINALIZED" && invoice.paymentStatus === filter;
  });

  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">BILLING OPERATIONS</p>
          <h1>Invoices</h1>
          <p>
            Prepare tenancy charges, finalize historical snapshots, and monitor
            collection.
          </p>
        </div>
        <MonthSelector month={month} />
      </header>

      <section className="summary-grid billing-summary">
        <SummaryCard
          label="Ready"
          value={`${ready} invoices`}
          detail="Can generate now"
          icon={<FileText />}
        />
        <SummaryCard
          label="Draft"
          value={`${drafts} invoices`}
          detail="Waiting for finalization"
          icon={<Layers3 />}
        />
        <SummaryCard
          label="Finalized"
          value={`${finalized.length} invoices`}
          detail="Immutable snapshots"
          icon={<FileText />}
        />
        <SummaryCard
          label="Outstanding"
          value={formatVnd(String(outstanding))}
          detail="Across finalized invoices"
          icon={<WalletCards />}
        />
      </section>

      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Billing candidates</h2>
            <p>Readiness is derived per tenancy and billing period.</p>
          </div>
          <ActionForm
            action={generateAllReadyAction}
            fields={{ propertyId, billingPeriod: `${month}-01` }}
            label={`Generate all ready (${ready})`}
            disabled={!ready}
            variant="outline"
          />
        </div>
        {candidates.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Responsible renter</th>
                  <th>Service period</th>
                  <th>Readiness</th>
                  <th>Issue</th>
                  <th>Invoice status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.tenancyId}>
                    <td>
                      <Link className="billing-table-link" href="/">
                        <strong>{candidate.room}</strong>
                      </Link>
                    </td>
                    <td>
                      <Link className="billing-table-link" href="/tenants">
                        {candidate.renterName}
                      </Link>
                    </td>
                    <td>
                      {formatDate(candidate.serviceStart)} →{" "}
                      {formatDate(candidate.serviceEnd)}
                    </td>
                    <td>
                      <BillingStatusBadge status={candidate.readiness} />
                    </td>
                    <td>
                      <CandidateIssue candidate={candidate} />
                    </td>
                    <td>
                      {candidate.invoiceId ? (
                        <BillingStatusBadge status={candidate.status} />
                      ) : (
                        <span className="utility-subtle">Not generated</span>
                      )}
                    </td>
                    <td>
                      <CandidateAction
                        candidate={candidate}
                        propertyId={propertyId}
                        month={month}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No billing candidates"
            description="No tenancies overlap this billing month."
          />
        )}
      </section>

      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Invoice register</h2>
            <p>Filter drafts, finalized snapshots, and collection state.</p>
          </div>
          <Button
            variant="outline"
            disabled={!selected.length}
            onClick={() =>
              finalized
                .filter((invoice) => selected.includes(invoice.id))
                .forEach(exportInvoicePng)
            }
          >
            <Download /> Export selected ({selected.length})
          </Button>
        </div>
        <div className="billing-filter-tabs">
          {(
            [
              "ALL",
              "DRAFT",
              "FINALIZED",
              "UNPAID",
              "PARTIAL",
              "PAID",
            ] as Filter[]
          ).map((item) => (
            <button
              type="button"
              key={item}
              className={filter === item ? "is-active" : ""}
              onClick={() => setFilter(item)}
            >
              {title(item)}
            </button>
          ))}
        </div>
        {filtered.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Invoice</th>
                  <th>Tenant</th>
                  <th>Room</th>
                  <th>Billing period</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      {invoice.status === "FINALIZED" && (
                        <input
                          className="invoice-select"
                          type="checkbox"
                          aria-label={`Select ${invoice.room} invoice`}
                          checked={selected.includes(invoice.id)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, invoice.id]
                                : current.filter((id) => id !== invoice.id),
                            )
                          }
                        />
                      )}
                    </td>
                    <td>
                      <Link
                        className="billing-table-link"
                        href={`/billing/invoices/${invoice.id}`}
                      >
                        <strong>
                          INV-{invoice.id.slice(-6).toUpperCase()}
                        </strong>
                      </Link>
                    </td>
                    <td>
                      <Link className="billing-table-link" href="/tenants">
                        {invoice.renterName}
                      </Link>
                    </td>
                    <td>
                      <Link className="billing-table-link" href="/">
                        {invoice.room}
                      </Link>
                    </td>
                    <td>{monthLabel(invoice.billingPeriod)}</td>
                    <td>
                      <BillingStatusBadge status={invoice.status} />
                    </td>
                    <td>
                      <strong>{formatVnd(invoice.total)}</strong>
                    </td>
                    <td>
                      {invoice.status === "FINALIZED" ? (
                        <BillingStatusBadge status={invoice.paymentStatus} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {invoice.status === "FINALIZED"
                        ? formatVnd(invoice.balance)
                        : "—"}
                    </td>
                    <td className="billing-actions">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/billing/invoices/${invoice.id}`}>
                          {invoice.status === "DRAFT" ? "Continue" : "View"}
                        </Link>
                      </Button>
                      {invoice.status === "FINALIZED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => exportInvoicePng(invoice)}
                        >
                          <Download /> PNG
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={`No ${title(filter).toLowerCase()} invoices`}
            description="Try another invoice filter or billing month."
          />
        )}
      </section>
    </div>
  );
}

function CandidateIssue({ candidate }: { candidate: Candidates[number] }) {
  const issue = candidate.missing[0];
  if (!issue) return <span className="utility-subtle">No blocking issue</span>;
  const isRate = issue.toLowerCase().includes("rate");
  return (
    <div className="candidate-issue">
      <span>{conciseIssue(issue)}</span>
      <Link href={isRate ? "/utilities/rates" : "/utilities/meters"}>
        {isRate ? "Open rates" : "Resolve in meters"}
      </Link>
    </div>
  );
}
function CandidateAction({
  candidate,
  propertyId,
  month,
}: {
  candidate: Candidates[number];
  propertyId: string;
  month: string;
}) {
  if (candidate.status === "READY")
    return (
      <ActionForm
        action={generateInvoiceAction}
        fields={{
          propertyId,
          tenancyId: candidate.tenancyId,
          billingPeriod: `${month}-01`,
        }}
        label="Generate"
      />
    );
  if (candidate.invoiceId)
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/billing/invoices/${candidate.invoiceId}`}>
          {candidate.status === "DRAFT" ? "Continue" : "View"}
        </Link>
      </Button>
    );
  return <span className="utility-subtle">—</span>;
}
function ActionForm({
  action,
  fields,
  label,
  disabled,
  variant,
}: {
  action: (_: ActionState, data: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  disabled?: boolean;
  variant?: "outline";
}) {
  const [state, formAction] = React.useActionState(action, emptyActionState);
  return (
    <form action={formAction} className="billing-inline-form">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button size="sm" variant={variant} disabled={disabled}>
        {label}
      </Button>
      {state.message && (
        <small className={state.ok ? "form-success" : "form-error"}>
          {state.message}
        </small>
      )}
    </form>
  );
}
function SummaryCard({
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
function conciseIssue(issue: string) {
  if (issue.toLowerCase().includes("move-out"))
    return "Missing move-out meter boundary";
  if (issue.toLowerCase().includes("move-in"))
    return "Missing move-in meter boundary";
  if (issue.toLowerCase().includes("rate")) return "Missing utility rate";
  return issue;
}
function title(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}
