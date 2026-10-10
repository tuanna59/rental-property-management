export type BillingDomainErrorCode =
  | "VOID_REASON_REQUIRED"
  | "INVOICE_NOT_FINALIZED"
  | "INVOICE_ALREADY_VOIDED"
  | "INVOICE_HAS_PAYMENTS"
  | "INVOICE_HAS_ADJUSTMENTS"
  | "CORRECTION_ALREADY_EXISTS"
  | "ACTIVE_INVOICE_EXISTS"
  | "ADJUSTMENT_REASON_REQUIRED"
  | "ADJUSTMENT_FINALIZED_ONLY"
  | "ADJUSTMENT_OVERPAYMENT"
  | "ADJUSTMENT_IMMUTABLE"
  | "DRAFT_ADJUSTMENT_ONLY"
  | "DRAFT_ADJUSTMENT_EXISTS"
  | "DRAFT_ADJUSTMENT_NOT_FOUND";

export class BillingDomainError extends Error {
  constructor(
    public readonly code: BillingDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BillingDomainError";
  }
}
