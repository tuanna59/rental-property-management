export const EXPENSE_CATEGORIES = [
  "REPAIR",
  "UTILITIES",
  "CLEANING",
  "SUPPLIES",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const MAINTENANCE_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

export const TASK_STATUSES = ["TODO", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_LINK_TYPES = [
  "PROPERTY",
  "SPACE",
  "MAINTENANCE",
  "INVOICE",
] as const;
export type TaskLinkedEntityType = (typeof TASK_LINK_TYPES)[number];

export const TASK_RECURRENCE_UNITS = ["DAYS", "MONTHS", "YEARS"] as const;
export type TaskRecurrenceUnit = (typeof TASK_RECURRENCE_UNITS)[number];

export type OperationsLocationOption = {
  floorId: string;
  floorName: string;
  spaceId: string;
  spaceName: string;
};

export type OperationsAssetOption = {
  id: string;
  name: string;
  floorId: string | null;
  spaceId: string | null;
  locationLabel: string;
};

export type OperationsInvoiceOption = {
  id: string;
  room: string;
  renter: string;
  billingMonth: string;
};

export type RelatedExpenseView = {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  amountVnd: string;
  description: string;
};

export type MaintenancePhotoView = {
  id: string;
  url: string;
  createdAt: string;
};

export type MaintenanceListItemView = {
  id: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  reportedAt: string;
  reportedBy: string | null;
  assignedTo: string | null;
  floorId: string | null;
  floorName: string | null;
  spaceId: string | null;
  spaceName: string | null;
  locationLabel: string;
  notes: string | null;
  resolution: string | null;
  completedAt: string | null;
  costVnd: string;
  photoCount: number;
  photos: MaintenancePhotoView[];
  relatedExpenses: RelatedExpenseView[];
  assetId: string | null;
  assetName: string | null;
};

export type MaintenanceSummaryView = {
  open: number;
  inProgress: number;
  urgent: number;
  completedThisMonth: number;
};

export type MaintenancePageView = {
  schemaReady: boolean;
  summary: MaintenanceSummaryView;
  items: MaintenanceListItemView[];
  locations: OperationsLocationOption[];
  assetOptions: OperationsAssetOption[];
};

export type ExpenseListItemView = {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amountVnd: string;
  notes: string | null;
  floorId: string | null;
  floorName: string | null;
  spaceId: string | null;
  spaceName: string | null;
  locationLabel: string;
  maintenanceIssueId: string | null;
  maintenanceTitle: string | null;
  hasReceipt: boolean;
  receiptMediaType: "image" | "pdf" | null;
  assetId: string | null;
  assetName: string | null;
};

export type ExpenseSummaryView = {
  totalVnd: string;
  repairVnd: string;
  utilitiesVnd: string;
  otherVnd: string;
  count: number;
};

export type ExpensePageView = {
  schemaReady: boolean;
  summary: ExpenseSummaryView;
  items: ExpenseListItemView[];
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  maintenanceItems: MaintenanceListItemView[];
  assetOptions: OperationsAssetOption[];
};

export type TaskListItemView = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  linkedEntityType: TaskLinkedEntityType | null;
  linkedEntityId: string | null;
  linkedLabel: string | null;
  recurrenceUnit: TaskRecurrenceUnit | null;
  recurrenceInterval: number | null;
  completedAt: string | null;
  overdue: boolean;
};

export type TaskSummaryView = {
  dueOrOverdue: number;
  overdue: number;
  upcoming: number;
  completedThisMonth: number;
};

export type TaskPageView = {
  schemaReady: boolean;
  summary: TaskSummaryView;
  items: TaskListItemView[];
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  invoiceOptions: OperationsInvoiceOption[];
};

export type SpaceMaintenanceSignal = {
  spaceId: string;
  openCount: number;
  urgentCount: number;
};
