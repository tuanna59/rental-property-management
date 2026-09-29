import type { BuildingVisualProjection } from "@/modules/property/domain/types";

export type DashboardAttentionSeverity = "BLOCKING" | "URGENT" | "WARNING" | "INFO";
export type DashboardAttentionType =
  | "BILLING"
  | "UTILITIES"
  | "MAINTENANCE"
  | "TASK"
  | "ASSET"
  | "DEVICE"
  | "TENANCY";

export type DashboardAttentionCode =
  | "INVOICE_UNPAID"
  | "INVOICE_PARTIAL"
  | "UTILITY_BOUNDARY"
  | "UTILITY_CLOSING"
  | "UTILITY_ATTENTION"
  | "MAINTENANCE_URGENT"
  | "MAINTENANCE_HIGH"
  | "TASK_OVERDUE"
  | "DEVICE_OFFLINE";

export type DashboardAttentionItem = {
  id: string;
  type: DashboardAttentionType;
  code: DashboardAttentionCode;
  severity: DashboardAttentionSeverity;
  subject: string;
  context?: string | null;
  href: string;
  spaceId: string | null;
  date: string | null;
  amountVnd?: string;
  count?: number;
};

export type DashboardAttentionGroup = {
  id: string;
  type: DashboardAttentionType;
  severity: DashboardAttentionSeverity;
  count: number;
  href: string;
  amountVnd?: string;
};

export type DashboardTrendPoint = {
  month: string;
  label: string;
  billedVnd: string;
  collectedVnd: string;
  expensesVnd: string;
};

export type DashboardRecentPayment = {
  id: string;
  tenantName: string;
  room: string;
  amountVnd: string;
  paymentDate: string;
  href: string;
};

export type DashboardUpcomingItem = {
  id: string;
  type: "MOVE_IN" | "MOVE_OUT" | "TASK" | "WARRANTY";
  date: string;
  subject: string;
  context?: string | null;
  href: string;
};

export type DashboardProjection = {
  propertyId: string;
  propertyName: string;
  period: { month: string; label: string };
  financial: {
    billedVnd: string;
    collectedVnd: string;
    expensesVnd: string;
    netCashVnd: string;
    finalizedInvoiceCount: number;
    paymentCount: number;
    expenseCount: number;
  };
  occupancy: {
    occupiedRooms: number;
    totalRentableRooms: number;
    rate: number;
    currentOccupants: number;
    upcomingMoveIns: number;
  };
  billingSummary: {
    finalizedInvoiceCount: number;
    paidInvoiceCount: number;
    unpaidInvoiceCount: number;
    partialInvoiceCount: number;
    billedVnd: string;
    paidVnd: string;
    outstandingVnd: string;
    collectionRate: number | null;
  };
  attentionItems: DashboardAttentionItem[];
  attentionGroups: DashboardAttentionGroup[];
  attentionTotal: number;
  propertySummary: {
    rentalRoomCount: number;
    floorCount: number;
    otherSpaceCount: number;
  };
  financialTrend: DashboardTrendPoint[];
  recentPayments: DashboardRecentPayment[];
  upcomingItems: DashboardUpcomingItem[];
  building: BuildingVisualProjection;
};

export type FinancialReportProjection = {
  year: number;
  summary: {
    billedVnd: string;
    collectedVnd: string;
    expensesVnd: string;
    netCashVnd: string;
  };
  monthly: Array<{
    month: string;
    label: string;
    billedVnd: string;
    collectedVnd: string;
    expensesVnd: string;
    netCashVnd: string;
  }>;
};

export type RevenueReportRow = {
  id: string;
  billingPeriod: string;
  room: string;
  tenantName: string;
  billedVnd: string;
  paidVnd: string;
  outstandingVnd: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  href: string;
};

export type RevenueReportProjection = {
  year: number;
  summary: { billedVnd: string; paidVnd: string; outstandingVnd: string };
  rows: RevenueReportRow[];
};

export type ExpenseReportRow = {
  id: string;
  expenseDate: string;
  description: string;
  category: string;
  location: string;
  assetName: string | null;
  maintenanceTitle: string | null;
  amountVnd: string;
};

export type ExpenseReportProjection = {
  year: number;
  summary: {
    totalVnd: string;
    repairVnd: string;
    utilitiesVnd: string;
    otherVnd: string;
  };
  monthly: Array<{ month: string; label: string; amountVnd: string }>;
  categoryBreakdown: Array<{ category: string; amountVnd: string }>;
  rows: ExpenseReportRow[];
};

export type OccupancyReportProjection = {
  year: number;
  summary: {
    occupancyRate: number;
    occupiedRoomDays: number;
    vacantRoomDays: number;
    availableRoomDays: number;
    moveIns: number;
    moveOuts: number;
  };
  monthly: Array<{
    month: string;
    label: string;
    occupancyRate: number;
    occupiedRoomDays: number;
    vacantRoomDays: number;
  }>;
  roomBreakdown: Array<{
    spaceId: string;
    room: string;
    occupancyRate: number;
    occupiedDays: number;
    vacantDays: number;
  }>;
};

export type UtilityReportProjection = {
  year: number;
  electricity: {
    totalTenantKwh: string;
    totalChargeVnd: string;
    monthly: Array<{
      month: string;
      label: string;
      tenantKwh: string;
      chargeVnd: string;
    }>;
    rooms: Array<{ room: string; tenantKwh: string; chargeVnd: string }>;
  };
  water: {
    totalChargeVnd: string;
    totalBillablePeople: number;
    monthly: Array<{
      month: string;
      label: string;
      billablePeople: number;
      chargeVnd: string;
    }>;
  };
};

export type DepositReportProjection = {
  year: number;
  summary: {
    expectedVnd: string;
    receivedVnd: string;
    heldVnd: string;
    refundedVnd: string;
    deductedVnd: string;
    appliedVnd: string;
  };
  rows: Array<{
    tenancyId: string;
    tenantName: string;
    room: string;
    expectedVnd: string;
    receivedVnd: string;
    heldVnd: string;
    refundedVnd: string;
    deductedVnd: string;
    appliedVnd: string;
  }>;
};

export type ReportsProjection = {
  propertyId: string;
  propertyName: string;
  year: number;
  availableYears: number[];
  financial: FinancialReportProjection;
  revenue: RevenueReportProjection;
  expenses: ExpenseReportProjection;
  occupancy: OccupancyReportProjection;
  utilities: UtilityReportProjection;
  deposits: DepositReportProjection;
};
