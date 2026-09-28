export type BusinessDateInput = string | Date;
export type DecimalInput = string | number;
export type ReadingSource = "MEASURED" | "ESTIMATED";
export type ReadingType =
  | "MONTHLY"
  | "MOVE_IN"
  | "MOVE_OUT"
  | "METER_INSTALL"
  | "METER_REMOVAL"
  | "MANUAL";

export type InstallMeterInput = {
  spaceId: string;
  meterNumber?: string;
  installedAt: BusinessDateInput;
  initialReading: DecimalInput;
  photo?: File;
  notes?: string;
};
export type RecordReadingInput = {
  meterId: string;
  billingMonth?: BusinessDateInput;
  readingDate: BusinessDateInput;
  readingValue: DecimalInput;
  readingType: ReadingType;
  source: ReadingSource;
  photo?: File;
  notes?: string;
  reason?: string;
};
export type SaveMonthlyReadingInput = {
  meterId: string;
  billingMonth: BusinessDateInput;
  readingDate: BusinessDateInput;
  readingValue: DecimalInput;
  source: ReadingSource;
  photo?: File;
  notes?: string;
  reason?: string;
};
export type ReplaceMeterInput = {
  spaceId: string;
  replacementDate: BusinessDateInput;
  oldMeterFinalReading?: DecimalInput | null;
  oldMeterFinalReadingSource?: ReadingSource;
  oldMeterPhoto?: File;
  newMeterNumber?: string;
  newMeterInitialReading: DecimalInput;
  newMeterPhoto?: File;
  reason: string;
  notes?: string;
};
export type RecordMissingBoundaryInput = {
  tenancyId: string;
  boundaryType: "MOVE_IN" | "MOVE_OUT";
  readingValue: DecimalInput;
  source: ReadingSource;
  photo?: File;
  notes?: string;
  reason?: string;
};
export type AddRateInput = {
  propertyId: string;
  utilityType: "ELECTRICITY" | "WATER";
  rate: DecimalInput;
  effectiveFrom: BusinessDateInput;
  notes?: string;
};
export type ElectricityOverrideInput = {
  spaceId: string;
  billingMonth: BusinessDateInput;
  rate: DecimalInput;
  reason: string;
};
