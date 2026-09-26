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
} from "./server/queries";
export { moveIn, moveOut } from "./server/services";
