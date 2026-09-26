export type CreatePersonInput = {
  fullName: string;
  phone?: string;
  dateOfBirth?: Date;
  citizenId?: string;
  notes?: string;
};

export type UpdatePersonInput = CreatePersonInput & {
  personId: string;
};

export type PersonRecord = {
  id: string;
  fullName: string;
  phone: string | null;
  phoneNormalized: string | null;
  dateOfBirth: Date | null;
  citizenIdLast4: string | null;
  hasCitizenId: boolean;
  hasAvatar: boolean;
  hasCitizenIdFront: boolean;
  hasCitizenIdBack: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};
