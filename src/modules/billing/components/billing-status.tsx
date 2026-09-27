export function BillingStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    status === "READY" ||
    status === "FINALIZED" ||
    status === "PAID" ||
    status === "HELD"
      ? "is-complete"
      : status === "MISSING_DATA" ||
          status === "UNPAID" ||
          status === "NEEDS_SETTLEMENT"
        ? "is-incomplete"
        : "is-estimated";
  return (
    <span className={`utility-status billing-status ${tone}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}
