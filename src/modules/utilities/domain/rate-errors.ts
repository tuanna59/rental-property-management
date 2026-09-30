export type UtilityRateErrorCode =
  | "OVERRIDE_REASON_REQUIRED"
  | "OVERRIDE_UTILITY_INVALID"
  | "OVERRIDE_EXPIRE_INVALID"
  | "OVERRIDE_RANGE_OVERLAP"
  | "OVERRIDE_FINALIZED_PERIOD";

export class UtilityRateDomainError extends Error {
  constructor(
    public readonly code: UtilityRateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UtilityRateDomainError";
  }
}
