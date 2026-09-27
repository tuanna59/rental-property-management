export { TenancyDomainError } from "./domain/errors";
export type {
  ActiveOccupant,
  MoveInInput,
  MoveOutInput,
  SpaceOccupancy,
} from "./domain/types";
export {
  countActiveOccupantsForTenancy,
  getActiveOccupantsForTenancy,
  getCurrentOccupancyBySpaceIds,
  getCurrentResponsiblePerson,
  getCurrentTenancyForSpace,
} from "./server/tenancy.queries";
export { moveIn, moveOut } from "./server/tenancy.service";
