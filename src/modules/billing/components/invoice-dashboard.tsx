"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Download, FileText, Layers3, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthLocale, formatVndLocale } from "@/i18n/format";
import { MonthSelector } from "@/modules/utilities/components/utility-ui";
import { generateAllReadyAction, generateInvoiceAction } from "../actions";
import type {
  getBillingCandidates,
  getInvoices,
} from "../server/billing.queries";
import { BillingStatusBadge } from "./billing-status";
import { exportInvoicePng } from "./invoice-export";

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
  const t = useTranslations("billing");
  const locale = useLocale() as AppLocale;
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
          <p className="utilities-eyebrow">{t("eyebrow")}</p>
          <h1>{t("invoices")}</h1>
<p>{t("invoiceSubtitleLong")}</p>
        </div>
        <MonthSelector month={month} />
      </header>

      <section className="summary-grid billing-summary">
        <SummaryCard
          label={t("ready")}
          value={t("invoicesCount", { count: ready })}
          detail={t("canGenerateNow")}
          icon={<FileText />}
        />
        <SummaryCard
          label={t("draft")}
          value={t("invoicesCount", { count: drafts })}
          detail={t("waitingFinalization")}
          icon={<Layers3 />}
        />
        <SummaryCard
          label={t("finalized")}
          value={t("invoicesCount", { count: finalized.length })}
          detail={t("immutableSnapshots")}
          icon={<FileText />}
        />
        <SummaryCard
          label={t("outstanding")}
          value={formatVndLocale(String(outstanding), locale)}
          detail={t("acrossFinalized")}
          icon={<WalletCards />}
        />
      </section>

      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("billingCandidates")}</h2>
            <p>{t("invoiceSubtitle")}</p>
          </div>
          <ActionForm
            action={generateAllReadyAction}
            fields={{ propertyId, billingPeriod: `${month}-01` }}
            label={t("generateAllReady", { count: ready })}
            disabled={!ready}
            variant="outline"
          />
        </div>
        {candidates.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>{t("room")}</th>
                  <th>{t("responsibleRenter")}</th>
                  <th>{t("invoiceType")}</th>
                  <th>{t("servicePeriod")}</th>
                  <th>{t("readiness")}</th>
                  <th>{t("issue")}</th>
                  <th>{t("invoiceStatus")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.candidateKey}>
                    <td>
                      <Link className="billing-table-link" href="/building">
                        <strong>{candidate.room}</strong>
                      </Link>
                    </td>
                    <td>
                      <Link className="billing-table-link" href="/tenants">
                        {candidate.renterName}
                      </Link>
                    </td>
                    <td>
                      {candidate.invoiceType === "REGULAR"
                        ? t("regular")
                        : t("finalSettlement")}
                    </td>
                    <td>
                      {formatDateOnlyLocale(candidate.serviceStart, locale)} →{" "}
                      {formatDateOnlyLocale(candidate.serviceEnd, locale)}
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
                        <span className="utility-subtle">{t("notGenerated")}</span>
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
            title={t("noBillingCandidates")}
            description={t("noTenanciesOverlap")}
          />
        )}
      </section>

      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("invoiceRegister")}</h2>
            <p>{t("invoiceRegisterSubtitle")}</p>
          </div>
          <Button
            variant="outline"
            disabled={!selected.length}
            onClick={() =>
              finalized
                .filter((invoice) => selected.includes(invoice.id))
                .forEach((invoice) => exportInvoicePng(invoice, locale))
            }
          >
            <Download /> {t("downloadSelectedPng", { count: selected.length })}
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
              {statusLabel(item, t)}
            </button>
          ))}
        </div>
        {filtered.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{t("invoice")}</th>
                  <th>{t("tenant")}</th>
                  <th>{t("room")}</th>
                  <th>{t("billingPeriod")}</th>
                  <th>{t("status")}</th>
                  <th>{t("total")}</th>
                  <th>{t("payment")}</th>
                  <th>{t("balance")}</th>
                  <th>{t("actions")}</th>
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
                          aria-label={t("selectInvoice", { room: invoice.room })}
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
                      <Link className="billing-table-link" href="/building">
                        {invoice.room}
                      </Link>
                    </td>
                    <td>{formatMonthLocale(invoice.billingPeriod, locale)}</td>
                    <td>
                      <BillingStatusBadge status={invoice.status} />
                    </td>
                    <td>
                      <strong>{formatVndLocale(invoice.total, locale)}</strong>
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
                        ? formatVndLocale(invoice.balance, locale)
                        : "—"}
                    </td>
                    <td className="billing-actions">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/billing/invoices/${invoice.id}`}>
                          {invoice.status === "DRAFT" ? t("continue") : t("view")}
                        </Link>
                      </Button>
                      {invoice.status === "FINALIZED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => exportInvoicePng(invoice, locale)}
                        >
                          <Download /> {t("downloadPng")}
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
            title={t("noFilteredInvoices", { filter: statusLabel(filter, t).toLowerCase() })}
            description={t("tryAnotherFilter")}
          />
        )}
      </section>
    </div>
  );
}

function CandidateIssue({ candidate }: { candidate: Candidates[number] }) {
  const t = useTranslations("billing");
  const issue = candidate.missing[0];
  if (!issue) return <span className="utility-subtle">{t("noBlockingIssue")}</span>;
  const isRate = issue.toLowerCase().includes("rate");
  return (
    <div className="candidate-issue">
      <span>{conciseIssue(issue, t)}</span>
      <Link href={isRate ? "/utilities/rates" : "/utilities/meters"}>
        {isRate ? t("openRates") : t("resolveMeters")}
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
  const t = useTranslations("billing");
  if (candidate.status === "READY")
    return (
      <ActionForm
        action={generateInvoiceAction}
        fields={{
          propertyId,
          tenancyId: candidate.tenancyId,
          billingPeriod: `${month}-01`,
          invoiceType: candidate.invoiceType,
        }}
        label={t("generate")}
      />
    );
  if (candidate.invoiceId)
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/billing/invoices/${candidate.invoiceId}`}>
          {candidate.status === "DRAFT" ? t("continue") : t("view")}
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
function conciseIssue(issue: string, t: ReturnType<typeof useTranslations<"billing">>) {
  if (issue.toLowerCase().includes("move-out")) return t("missingMoveOutBoundary");
  if (issue.toLowerCase().includes("move-in")) return t("missingMoveInBoundary");
  if (issue.toLowerCase().includes("rate")) return t("missingRate");
  return issue;
}
function statusLabel(value: Filter, t: ReturnType<typeof useTranslations<"billing">>) {
  return ({ ALL: t("all"), DRAFT: t("draft"), FINALIZED: t("finalized"), UNPAID: t("unpaid"), PARTIAL: t("partial"), PAID: t("paid") })[value];
}
