export type RentRate = {
  id: string;
  effectiveFrom: Date;
  monthlyRentVnd: string;
  reason: string;
};

export type TenantInvoice = {
  id: string;
  billingPeriod: Date;
  invoiceDate: Date;
  type: "REGULAR" | "FINAL_SETTLEMENT";
  status: "DRAFT" | "FINALIZED" | "VOIDED";
  roomName: string;
  amount: string;
  balance: string;
  displayStatus: string;
  utilities: {
    electricityCharge: string;
    electricityUsage: string | null;
    waterCharge: string;
    total: string;
  };
  payments: Array<{
    id: string;
    paymentDate: Date;
    method: "CASH" | "BANK_TRANSFER" | "OTHER";
    amount: string;
    reference: string | null;
    isDepositApplication: boolean;
  }>;
};

export type HistoryItem = {
  membershipId: string;
  tenancyId: string;
  role: "RESPONSIBLE" | "ADDITIONAL";
  startDate: Date;
  endDate: Date | null;
  moveInDate: Date;
  moveOutDate: Date | null;
  spaceId: string;
  spaceName: string;
  floorName: string;
  depositExpected: string | null;
  depositHeld: string;
  currentRent: RentRate;
  scheduledRent: RentRate | null;
  rentHistory: RentRate[];
  occupants: Array<{
    id: string;
    personId: string;
    personName: string;
    startDate: Date;
    endDate: Date | null;
  }>;
  responsibilityHistory: Array<{
    id: string;
    effectiveFrom: Date;
    reason: string;
    occupantId: string;
    personId: string;
    personName: string;
    previousPersonName: string | null;
  }>;
  invoices: TenantInvoice[];
};

export type PersonDocumentView = {
  id: string;
  type: "RENTAL_CONTRACT" | "CUSTOM";
  title: string;
  note: string | null;
  fileName: string;
  contentType: string;
  uploadedAt: Date;
  tenancyId: string | null;
};

export type DirectoryPerson = {
  id: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: Date | null;
  citizenIdLast4: string | null;
  hasCitizenId: boolean;
  hasAvatar: boolean;
  hasCitizenIdFront: boolean;
  hasCitizenIdBack: boolean;
  notes: string | null;
  archivedAt: Date | null;
  rentalState: "CURRENT" | "UPCOMING" | "FORMER" | "NO_RENTAL";
  currentTenancy: HistoryItem | null;
  upcomingTenancy: HistoryItem | null;
  lastTenancy: HistoryItem | null;
  rentalHistory: HistoryItem[];
  documents: PersonDocumentView[];
};

export type TenantStats = {
  total: number;
  current: number;
  currentRooms: number;
  upcoming: number;
  noRentalHistory: number;
  withRentalHistory: number;
};
