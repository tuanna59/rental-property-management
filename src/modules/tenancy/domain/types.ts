export type BusinessDateInput = string | Date;
export type VndInput = string | number | bigint;
export type TenancyOccupantRoleValue = "RESPONSIBLE" | "ADDITIONAL";

export type MoveInOccupantInput = {
  personId: string;
  role: TenancyOccupantRoleValue;
  startDate: BusinessDateInput;
  endDate?: BusinessDateInput | null;
  notes?: string;
};

export type MoveInInput = {
  spaceId: string;
  moveInDate: BusinessDateInput;
  moveOutDate?: BusinessDateInput | null;
  monthlyRentVnd: VndInput;
  depositVnd?: VndInput | null;
  moveInNotes?: string;
  electricityReading?: string | number | null;
  electricityPhoto?: File;
  occupants: MoveInOccupantInput[];
};

export type MoveOutInput = {
  tenancyId: string;
  moveOutDate: BusinessDateInput;
  moveOutNotes?: string;
  electricityReading?: string | number | null;
  electricityPhoto?: File;
  electricityReadingSource?: "MEASURED" | "ESTIMATED";
  electricityReadingReason?: string;
};

export type AddOccupantInput = {
  tenancyId: string;
  personId: string;
  startDate: BusinessDateInput;
  notes?: string;
};

export type EndOccupancyInput = {
  membershipId: string;
  endDate: BusinessDateInput;
  notes?: string;
};

export type MoveAdditionalOccupantInput = {
  membershipId: string;
  destinationSpaceId: string;
  effectiveDate: BusinessDateInput;
};

export type NormalizedMoveInOccupant = Omit<
  MoveInOccupantInput,
  "startDate" | "endDate"
> & {
  startDate: Date;
  endDate: Date | null;
};

export type NormalizedMoveInInput = Omit<
  MoveInInput,
  "moveInDate" | "moveOutDate" | "monthlyRentVnd" | "depositVnd" | "occupants"
> & {
  moveInDate: Date;
  moveOutDate: Date | null;
  monthlyRentVnd: bigint;
  depositVnd: bigint | null;
  occupants: NormalizedMoveInOccupant[];
};

export type NormalizedMoveOutInput = Omit<MoveOutInput, "moveOutDate"> & {
  moveOutDate: Date;
};

export type ActiveOccupant = {
  membershipId: string;
  personId: string;
  fullName: string;
  role: TenancyOccupantRoleValue;
  startDate: Date;
  endDate: Date | null;
};

export type SpaceOccupancy = {
  spaceId: string;
  tenancyId: string;
  moveInDate: Date;
  moveOutDate: Date | null;
  monthlyRentVnd: bigint;
  depositVnd: bigint | null;
  moveInNotes: string | null;
  moveOutNotes: string | null;
  occupants: ActiveOccupant[];
  occupantCount: number;
  responsible: ActiveOccupant | null;
};
