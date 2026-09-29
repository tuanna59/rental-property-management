import type { getActionFeedback } from "@/i18n/action-feedback";

import { TenancyDomainError, type TenancyErrorCode } from "./domain/errors";

type TenantsFeedback = Awaited<ReturnType<typeof getActionFeedback>>;

const TENANCY_ERROR_KEYS: Record<TenancyErrorCode, string> = {
  SPACE_NOT_FOUND: "errorSpaceNotFound",
  SPACE_NOT_ELIGIBLE: "errorSpaceNotEligible",
  PERSON_NOT_FOUND: "errorPersonNotFound",
  PERSON_ARCHIVED: "errorPersonArchived",
  INVALID_TENANCY_DATES: "errorInvalidTenancyDates",
  INVALID_MEMBERSHIP_DATES: "errorInvalidMembershipDates",
  INVALID_MONEY: "errorInvalidMoney",
  INVALID_RESPONSIBLE_CONFIGURATION: "errorInvalidResponsibleConfiguration",
  DUPLICATE_OCCUPANT: "errorDuplicateOccupant",
  TENANCY_OVERLAP: "errorTenancyOverlap",
  PERSON_OCCUPANCY_OVERLAP: "errorPersonOccupancyOverlap",
  TENANCY_NOT_FOUND: "errorTenancyNotFound",
  TENANCY_ALREADY_CLOSED: "errorTenancyAlreadyClosed",
  OCCUPANT_NOT_FOUND: "errorOccupantNotFound",
  RESPONSIBLE_CHANGE_UNSUPPORTED: "errorResponsibleChangeUnsupported",
  DESTINATION_TENANCY_REQUIRED: "errorDestinationTenancyRequired",
  UPCOMING_TENANCY_REQUIRED: "errorUpcomingTenancyRequired",
  SCHEDULED_MOVE_OUT_REQUIRED: "errorScheduledMoveOutRequired",
};

export function localizeTenancyError(
  error: TenancyDomainError,
  feedback: TenantsFeedback,
) {
  return feedback(TENANCY_ERROR_KEYS[error.code]);
}
