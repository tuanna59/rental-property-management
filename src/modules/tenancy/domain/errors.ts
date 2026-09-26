export type TenancyErrorCode =
  | "SPACE_NOT_FOUND"
  | "SPACE_NOT_ELIGIBLE"
  | "PERSON_NOT_FOUND"
  | "PERSON_ARCHIVED"
  | "INVALID_TENANCY_DATES"
  | "INVALID_MEMBERSHIP_DATES"
  | "INVALID_MONEY"
  | "INVALID_RESPONSIBLE_CONFIGURATION"
  | "DUPLICATE_OCCUPANT"
  | "TENANCY_OVERLAP"
  | "PERSON_OCCUPANCY_OVERLAP"
  | "TENANCY_NOT_FOUND"
  | "TENANCY_ALREADY_CLOSED"
  | "OCCUPANT_NOT_FOUND"
  | "RESPONSIBLE_CHANGE_UNSUPPORTED"
  | "DESTINATION_TENANCY_REQUIRED"
  | "UPCOMING_TENANCY_REQUIRED"
  | "SCHEDULED_MOVE_OUT_REQUIRED";

export class TenancyDomainError extends Error {
  constructor(
    public readonly code: TenancyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TenancyDomainError";
  }
}
