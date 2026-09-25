export const SPACE_TYPE_OPTIONS = [
  "ROOM",
  "OWNER_HOME",
  "GARAGE",
  "ROOFTOP",
  "COMMON_AREA",
  "STORAGE",
  "OTHER",
] as const;

export type SpaceTypeValue = (typeof SPACE_TYPE_OPTIONS)[number];

export const SPACE_TYPE_LABELS: Record<SpaceTypeValue, string> = {
  ROOM: "Rental Room",
  OWNER_HOME: "Owner Home",
  GARAGE: "Garage",
  ROOFTOP: "Rooftop",
  COMMON_AREA: "Common Area",
  STORAGE: "Storage",
  OTHER: "Other",
};

export type DashboardSpace = {
  id: string;
  floorId: string;
  name: string;
  type: SpaceTypeValue;
  sortOrder: number;
  notes: string | null;
};

export type DashboardFloor = {
  id: string;
  propertyId: string;
  name: string;
  level: number | null;
  sortOrder: number;
  notes: string | null;
  spaces: DashboardSpace[];
};

export type DashboardProperty = {
  id: string;
  name: string;
  description: string | null;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  floors: DashboardFloor[];
};
