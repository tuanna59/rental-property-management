"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import { PrivateAttachmentPicker } from "@/components/ui/private-attachment";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatVndLocale } from "@/i18n/format";

import {
  addMaintenancePhotosAction,
  archiveExpenseAction,
  archiveMaintenanceAction,
  archiveTaskAction,
  completeMaintenanceAction,
  completeTaskAction,
  createExpenseAction,
  createMaintenanceAction,
  createTaskAction,
  removeExpenseReceiptAction,
  removeMaintenancePhotoAction,
  startMaintenanceAction,
  updateExpenseAction,
  updateMaintenanceAction,
  updateTaskAction,
} from "../actions";
import type {
  ExpenseListItemView,
  MaintenanceListItemView,
  OperationsAssetOption,
  OperationsInvoiceOption,
  OperationsLocationOption,
  TaskListItemView,
} from "../domain/types";
import {
  OperationsPriorityBadge,
  OperationsStatusBadge,
  useOperationsLabels,
} from "./operations-ui";

const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function ActionDialogState({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>;
}

function useDialogAction(
  action: (previous: ActionState, data: FormData) => Promise<ActionState>,
  onSuccess: () => void,
) {
  const router = useRouter();
  return React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.ok) {
        onSuccess();
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  const id = React.useId();
  return (
    <div className="operations-field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

function TextareaField({
  label,
  ...props
}: React.ComponentProps<typeof Textarea> & { label: string }) {
  const id = React.useId();
  return (
    <div className="operations-field">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} {...props} />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
  required,
  disabled,
  onChange,
  value,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  value?: string;
}) {
  const id = React.useId();
  return (
    <div className="operations-field">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        required={required}
        disabled={disabled}
        onChange={onChange}
      >
        {children}
      </select>
    </div>
  );
}

function LocationFields({
  locations,
  defaultFloorId,
  defaultSpaceId,
}: {
  locations: OperationsLocationOption[];
  defaultFloorId?: string | null;
  defaultSpaceId?: string | null;
}) {
  const t = useTranslations("operations");
  const inferredFloor =
    defaultFloorId ||
    locations.find((location) => location.spaceId === defaultSpaceId)?.floorId ||
    "";
  const [floorId, setFloorId] = React.useState(inferredFloor);
  const [spaceId, setSpaceId] = React.useState(defaultSpaceId ?? "");
  const floorOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const location of locations) seen.set(location.floorId, location.floorName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [locations]);
  const roomOptions = React.useMemo(
    () => (floorId ? locations.filter((location) => location.floorId === floorId) : []),
    [floorId, locations],
  );

  React.useEffect(() => {
    if (!floorId) {
      setSpaceId("");
      return;
    }
    if (spaceId && !roomOptions.some((location) => location.spaceId === spaceId)) {
      setSpaceId("");
    }
  }, [floorId, roomOptions, spaceId]);

  return (
    <div className="operations-form-grid">
      <SelectField
        label={t("floor")}
        name="floorId"
        value={floorId}
        onChange={(event) => setFloorId(event.target.value)}
      >
        <option value="">{t("propertyLevel")}</option>
        {floorOptions.map((floor) => (
          <option key={floor.id} value={floor.id}>
            {floor.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t("roomSpace")}
        name="spaceId"
        value={spaceId}
        disabled={!floorId}
        onChange={(event) => setSpaceId(event.target.value)}
      >
        <option value="">{t("none")}</option>
        {roomOptions.map((location) => (
          <option key={location.spaceId} value={location.spaceId}>
            {location.spaceName}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export function ExpenseFormDialog({
  propertyId,
  locations,
  maintenanceOptions,
  assetOptions = [],
  expense,
  trigger,
  defaultAssetId,
  defaultFloorId,
  defaultSpaceId,
  autoOpen = false,
}: {
  propertyId: string;
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  assetOptions?: OperationsAssetOption[];
  expense?: ExpenseListItemView;
  trigger?: React.ReactNode;
  defaultAssetId?: string | null;
  defaultFloorId?: string | null;
  defaultSpaceId?: string | null;
  autoOpen?: boolean;
}) {
  const t = useTranslations("operations");
  const [open, setOpen] = React.useState(autoOpen);
  const serverAction = expense ? updateExpenseAction : createExpenseAction;
  const [state, action] = useDialogAction(serverAction, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> {t("addExpense")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-dialog-wide">
        <DialogHeader>
          <DialogTitle>{expense ? t("editExpense") : t("addExpense")}</DialogTitle>
          <DialogDescription>{t("expenseFormDescription")}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {expense && <input type="hidden" name="expenseId" value={expense.id} />}
          <div className="operations-form-grid">
            <Field
              label={t("expenseDate")}
              name="expenseDate"
              type="date"
              defaultValue={expense?.expenseDate ?? todayDate()}
              required
            />
            <SelectField
              label={t("expenseCategory")}
              name="category"
              defaultValue={expense?.category ?? "REPAIR"}
              required
            >
              <option value="REPAIR">{t("repair")}</option>
              <option value="UTILITIES">{t("utilitiesCategory")}</option>
              <option value="CLEANING">{t("cleaning")}</option>
              <option value="SUPPLIES">{t("supplies")}</option>
              <option value="OTHER">{t("other")}</option>
            </SelectField>
          </div>
          <div className="operations-form-grid">
            <Field
              label={t("amountVnd")}
              name="amount"
              type="number"
              min="1"
              step="1"
              defaultValue={expense?.amountVnd ?? ""}
              required
            />
            <Field
              label={t("description")}
              name="description"
              defaultValue={expense?.description ?? ""}
              required
            />
          </div>
          <LocationFields
            locations={locations}
            defaultFloorId={expense?.floorId ?? defaultFloorId}
            defaultSpaceId={expense?.spaceId ?? defaultSpaceId}
          />
          {assetOptions.length > 0 && (
            <SelectField
              label={t("assetOptional")}
              name="assetId"
              defaultValue={expense?.assetId ?? defaultAssetId ?? ""}
            >
              <option value="">{t("noLinkedAsset")}</option>
              {assetOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name} · {asset.locationLabel === "Property" ? t("propertyLevel") : asset.locationLabel}</option>
              ))}
            </SelectField>
          )}
          <SelectField
            label={t("linkedMaintenanceOptional")}
            name="maintenanceIssueId"
            defaultValue={expense?.maintenanceIssueId ?? ""}
          >
            <option value="">{t("noLinkedIssue")}</option>
            {maintenanceOptions.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issue.title} · {issue.locationLabel}
              </option>
            ))}
          </SelectField>
          <TextareaField label={t("notesOptional")} name="notes" defaultValue={expense?.notes ?? ""} />
          <div className="operations-attachment-field">
            <PrivateAttachmentPicker
              title={t("receipt")}
              name="receipt"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              emptyText={t("noReceiptAttached")}
              existingCount={expense?.hasReceipt ? 1 : 0}
              actionLabel={expense?.hasReceipt ? t("chooseReplacement") : t("addReceipt")}
              kind="receipt"
            />
            {expense?.hasReceipt && (
              <ExpenseReceiptViewer
                expense={expense}
                trigger={<button type="button" className="operations-attachment-view"><Eye /> {t("viewCurrentReceipt")}</button>}
              />
            )}
          </div>
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit">
              <ReceiptText /> {expense ? t("saveExpense") : t("recordExpense")}
            </Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function MaintenanceFormDialog({
  propertyId,
  locations,
  assetOptions = [],
  issue,
  trigger,
  defaultAssetId,
  defaultFloorId,
  defaultSpaceId,
  autoOpen = false,
}: {
  propertyId: string;
  locations: OperationsLocationOption[];
  assetOptions?: OperationsAssetOption[];
  issue?: MaintenanceListItemView;
  trigger?: React.ReactNode;
  defaultAssetId?: string | null;
  defaultFloorId?: string | null;
  defaultSpaceId?: string | null;
  autoOpen?: boolean;
}) {
  const t = useTranslations("operations");
  const [open, setOpen] = React.useState(autoOpen);
  const serverAction = issue ? updateMaintenanceAction : createMaintenanceAction;
  const [state, action] = useDialogAction(serverAction, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> {t("reportIssue")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-dialog-wide">
        <DialogHeader>
          <DialogTitle>{issue ? t("editMaintenanceIssue") : t("reportMaintenanceIssue")}</DialogTitle>
          <DialogDescription>
            {t("maintenanceFormDescription")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {issue && <input type="hidden" name="issueId" value={issue.id} />}
          <Field label={t("issueTitle")} name="title" defaultValue={issue?.title ?? ""} required />
          <TextareaField
            label={t("description")}
            name="description"
            defaultValue={issue?.description ?? ""}
            required
          />
          <div className="operations-form-grid">
            <SelectField
              label={t("priority")}
              name="priority"
              defaultValue={issue?.priority ?? "MEDIUM"}
              required
            >
              <option value="LOW">{t("low")}</option>
              <option value="MEDIUM">{t("medium")}</option>
              <option value="HIGH">{t("high")}</option>
              <option value="URGENT">{t("urgent")}</option>
            </SelectField>
            <Field
              label={t("reportedDate")}
              name="reportedAt"
              type="date"
              defaultValue={issue?.reportedAt ?? todayDate()}
              required
            />
          </div>
          <LocationFields
            locations={locations}
            defaultFloorId={issue?.floorId ?? defaultFloorId}
            defaultSpaceId={issue?.spaceId ?? defaultSpaceId}
          />
          {assetOptions.length > 0 && (
            <SelectField
              label={t("assetOptional")}
              name="assetId"
              defaultValue={issue?.assetId ?? defaultAssetId ?? ""}
            >
              <option value="">{t("noLinkedAsset")}</option>
              {assetOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name} · {asset.floorId || asset.spaceId ? asset.locationLabel : t("property")}</option>
              ))}
            </SelectField>
          )}
          <div className="operations-form-grid">
            <Field label={t("reportedByOptional")} name="reportedBy" defaultValue={issue?.reportedBy ?? ""} />
            <Field label={t("assignedToOptional")} name="assignedTo" defaultValue={issue?.assignedTo ?? ""} />
          </div>
          <TextareaField label={t("notesOptional")} name="notes" defaultValue={issue?.notes ?? ""} />
          {!issue && (
            <PrivateAttachmentPicker
              title={t("photos")}
              name="photos"
              accept="image/jpeg,image/png,image/webp"
              multiple
              emptyText={t("noPhotosAttached")}
              actionLabel={t("addPhotos")}
              kind="image"
            />
          )}
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit">
              <Wrench /> {issue ? t("saveIssue") : t("reportIssue")}
            </Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function TaskFormDialog({
  propertyId,
  locations,
  maintenanceOptions,
  invoiceOptions,
  task,
  trigger,
  defaultLinkedEntityType,
  defaultLinkedEntityId,
}: {
  propertyId: string;
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  invoiceOptions: OperationsInvoiceOption[];
  task?: TaskListItemView;
  trigger?: React.ReactNode;
  defaultLinkedEntityType?: "PROPERTY" | "SPACE" | "MAINTENANCE" | "INVOICE" | null;
  defaultLinkedEntityId?: string | null;
}) {
  const t = useTranslations("operations");
  const [open, setOpen] = React.useState(false);
  const [linkType, setLinkType] = React.useState<string>(task?.linkedEntityType ?? defaultLinkedEntityType ?? "");
  const [recurrence, setRecurrence] = React.useState<string>(task?.recurrenceUnit ?? "");
  const serverAction = task ? updateTaskAction : createTaskAction;
  const [state, action] = useDialogAction(serverAction, () => setOpen(false));

  const linkedOptions =
    linkType === "SPACE"
      ? locations.map((location) => ({
          id: location.spaceId,
          label: `${location.spaceName} · ${location.floorName}`,
        }))
      : linkType === "MAINTENANCE"
        ? maintenanceOptions.map((issue) => ({
            id: issue.id,
            label: `${issue.title} · ${issue.locationLabel}`,
          }))
        : linkType === "INVOICE"
          ? invoiceOptions.map((invoice) => ({
              id: invoice.id,
              label: `${invoice.room} · ${invoice.billingMonth} · ${invoice.renter}`,
            }))
          : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> {t("addTask")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-dialog-wide">
        <DialogHeader>
          <DialogTitle>{task ? t("editTask") : t("addTask")}</DialogTitle>
          <DialogDescription>{t("taskFormDescription")}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {task && <input type="hidden" name="taskId" value={task.id} />}
          <Field label={t("titleField")} name="title" defaultValue={task?.title ?? ""} required />
          <TextareaField label={t("descriptionOptional")} name="description" defaultValue={task?.description ?? ""} />
          <div className="operations-form-grid">
            <SelectField label={t("priority")} name="priority" defaultValue={task?.priority ?? "MEDIUM"} required>
              <option value="LOW">{t("low")}</option>
              <option value="MEDIUM">{t("medium")}</option>
              <option value="HIGH">{t("high")}</option>
            </SelectField>
            <Field label={t("dueDateOptional")} name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} />
          </div>
          <div className="operations-form-grid">
            <SelectField
              label={t("linkedContextOptional")}
              name="linkedEntityType"
              value={linkType}
              onChange={(event) => setLinkType(event.target.value)}
            >
              <option value="">{t("noLink")}</option>
              <option value="PROPERTY">{t("property")}</option>
              <option value="SPACE">{t("roomSpace")}</option>
              <option value="MAINTENANCE">{t("maintenanceIssue")}</option>
              <option value="INVOICE">{t("invoice")}</option>
            </SelectField>
            {linkType && linkType !== "PROPERTY" ? (
              <SelectField
                key={`${linkType}-${task?.linkedEntityId ?? ""}`}
                label={
                  linkType === "MAINTENANCE"
                    ? t("chooseMaintenanceIssue")
                    : linkType === "SPACE"
                      ? t("chooseRoomSpace")
                      : t("chooseInvoice")
                }
                name="linkedEntityId"
                defaultValue={
                  task?.linkedEntityType === linkType
                    ? task.linkedEntityId ?? ""
                    : defaultLinkedEntityType === linkType
                      ? defaultLinkedEntityId ?? ""
                      : ""
                }
                required
              >
                <option value="">{t("chooseRecord")}</option>
                {linkedOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <div className="operations-form-context">
                <span>{linkType === "PROPERTY" ? t("linkedToProperty") : t("noOperationalLink")}</span>
              </div>
            )}
          </div>
          <div className="operations-form-grid">
            <SelectField
              label={t("recurrence")}
              name="recurrenceUnit"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
            >
              <option value="">{t("oneTime")}</option>
              <option value="DAYS">{t("repeatByDays")}</option>
              <option value="MONTHS">{t("repeatByMonths")}</option>
              <option value="YEARS">{t("repeatByYears")}</option>
            </SelectField>
            {recurrence ? (
              <Field
                label={t("repeatEveryUnit", { unit: recurrence === "DAYS" ? t("days") : recurrence === "MONTHS" ? t("months") : t("years") })}
                name="recurrenceInterval"
                type="number"
                min="1"
                step="1"
                defaultValue={task?.recurrenceInterval ?? 1}
                required
              />
            ) : (
              <div className="operations-form-context">
                <span>{t("completeOnceHistory")}</span>
              </div>
            )}
          </div>
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit">
              <Check /> {task ? t("saveTask") : t("createTask")}
            </Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function MaintenanceDetailDialog({
  propertyId,
  issue,
  locations,
  assetOptions = [],
  trigger,
  autoOpen = false,
  suppressTrigger = false,
}: {
  propertyId: string;
  issue: MaintenanceListItemView;
  locations: OperationsLocationOption[];
  assetOptions?: OperationsAssetOption[];
  trigger?: React.ReactNode;
  autoOpen?: boolean;
  suppressTrigger?: boolean;
}) {
  const t = useTranslations("operations");
  const locale = useLocale() as AppLocale;
  const { categoryLabel: localizedCategoryLabel } = useOperationsLabels();
  const [open, setOpen] = React.useState(autoOpen);
  const [activeTab, setActiveTab] = React.useState<"OVERVIEW" | "PHOTOS" | "EXPENSES" | "HISTORY">("OVERVIEW");
  const router = useRouter();
  const [startState, startAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await startMaintenanceAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const [archiveState, archiveAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await archiveMaintenanceAction(previous, data);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );

  const historyEvents = React.useMemo(() => {
    const events: Array<{
      id: string;
      date: string;
      title: string;
      detail?: string | null;
    }> = [
      {
        id: `reported-${issue.id}`,
        date: issue.reportedAt,
        title: t("reportedEvent"),
        detail: issue.reportedBy ? t("byPerson", { name: issue.reportedBy }) : null,
      },
    ];

    issue.photos.forEach((photo, index) => {
      events.push({
        id: `photo-${photo.id}`,
        date: photo.createdAt,
        title: t("photoAddedEvent"),
        detail: t("photoNumber", { index: index + 1 }),
      });
    });

    issue.relatedExpenses.forEach((expense) => {
      events.push({
        id: `expense-${expense.id}`,
        date: expense.expenseDate,
        title: t("expenseRecordedEvent"),
        detail: `${expense.description} · ${formatVndLocale(expense.amountVnd, locale)}`,
      });
    });

    if (issue.completedAt) {
      events.push({
        id: `completed-${issue.id}`,
        date: issue.completedAt,
        title: t("issueCompletedEvent"),
        detail: issue.resolution || t("completed"),
      });
    }

    return events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [issue, locale, t]);

  const tabs = [
    { id: "OVERVIEW" as const, label: t("overview") },
    { id: "PHOTOS" as const, label: t("photos") },
    { id: "EXPENSES" as const, label: t("expenses") },
    { id: "HISTORY" as const, label: t("history") },
  ];

  const issueLocationLabel = issue.spaceName
    ? issue.floorName
      ? `${issue.spaceName} · ${issue.floorName}`
      : issue.spaceName
    : issue.floorName || t("property");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!suppressTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="ghost" className="operations-view-button">
              <Eye /> {t("view")}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="operations-dialog operations-detail-dialog">
        <DialogHeader>
          <div className="operations-detail-title-row">
            <div>
              <DialogTitle>{issue.title}</DialogTitle>
              <DialogDescription>
                {issueLocationLabel} · {t("reportedOn", { date: formatDateOnlyLocale(issue.reportedAt, locale) })}
              </DialogDescription>
            </div>
            <div className="operations-detail-badges">
              <OperationsPriorityBadge priority={issue.priority} />
              <OperationsStatusBadge status={issue.status} />
            </div>
          </div>
        </DialogHeader>

        <div
          className="operations-detail-tabs"
          role="tablist"
          aria-label={t("maintenanceDetailSections")}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="operations-detail-tab-panel" role="tabpanel">
          {activeTab === "OVERVIEW" && (
            <div className="operations-detail-tab-stack">
              <div className="operations-detail-meta">
                <div>
                  <span>{t("reported")}</span>
                  <strong>{formatDateOnlyLocale(issue.reportedAt, locale)}</strong>
                  {issue.reportedBy && <small>{t("byPerson", { name: issue.reportedBy })}</small>}
                </div>
                <div>
                  <span>{t("assignedTo")}</span>
                  <strong>{issue.assignedTo || t("unassigned")}</strong>
                </div>
                <div>
                  <span>{t("location")}</span>
                  <strong>{issueLocationLabel}</strong>
                </div>
                <div>
                  <span>{t("relatedCost")}</span>
                  <strong>{formatVndLocale(issue.costVnd, locale)}</strong>
                  {issue.assetName && issue.assetId && (
                    <small>
                      <a className="operations-context-link" href={`/assets/${issue.assetId}`}>
                        {t("assetContext", { name: issue.assetName })}
                      </a>
                    </small>
                  )}
                </div>
              </div>

              <section className="operations-detail-section">
                <h3>{t("description")}</h3>
                <p>{issue.description}</p>
                {issue.notes && (
                  <div className="operations-note">
                    <strong>{t("notes")}</strong>
                    <p>{issue.notes}</p>
                  </div>
                )}
              </section>

              {issue.status !== "COMPLETED" && (
                <section className="operations-detail-section operations-detail-actions-section">
                  <h3>{t("work")}</h3>
                  <div className="operations-detail-actions">
                    {issue.status === "OPEN" && (
                      <PreservingActionForm action={startAction} className="operations-inline-action">
                        <input type="hidden" name="issueId" value={issue.id} />
                        <Input
                          name="assignedTo"
                          defaultValue={issue.assignedTo ?? ""}
                          placeholder={t("assignToOptional")}
                        />
                        <Button type="submit"><ArrowRight /> {t("startWork")}</Button>
                      </PreservingActionForm>
                    )}
                    {issue.status === "IN_PROGRESS" && (
                      <CompleteMaintenanceDialog issue={issue} />
                    )}
                    <MaintenanceFormDialog
                      propertyId={propertyId}
                      locations={locations}
                      assetOptions={assetOptions}
                      issue={issue}
                      trigger={<Button type="button" variant="outline"><Pencil /> {t("edit")}</Button>}
                    />
                  </div>
                  <ActionDialogState state={startState} />
                </section>
              )}

              {issue.status === "COMPLETED" && (
                <section className="operations-detail-section operations-resolution">
                  <h3>{t("resolution")}</h3>
                  <p>{issue.resolution || t("completed")}</p>
                  {issue.completedAt && (
                    <span>{t("completedOn", { date: formatDateOnlyLocale(issue.completedAt, locale) })}</span>
                  )}
                </section>
              )}
            </div>
          )}

          {activeTab === "PHOTOS" && (
            <section className="operations-detail-section operations-attachments-section">
              <div className="operations-section-heading-inline">
                <h3>{t("photos")}</h3>
                <span>
                  {issue.photos.length
                    ? t("attachedCount", { count: issue.photos.length })
                    : t("noPhotosAttached")}
                </span>
              </div>
              {issue.photos.length > 0 ? (
                <MaintenancePhotoGallery issue={issue} />
              ) : (
                <p className="operations-muted">{t("noPhotosAttached")}</p>
              )}
              {issue.status !== "COMPLETED" && (
                <MaintenancePhotoUpload
                  propertyId={propertyId}
                  issueId={issue.id}
                  existingCount={issue.photos.length}
                />
              )}
            </section>
          )}

          {activeTab === "EXPENSES" && (
            <section className="operations-detail-section">
              <div className="operations-section-heading-inline">
                <h3>{t("relatedExpenses")}</h3>
                <span>{issue.relatedExpenses.length}</span>
              </div>
              {issue.relatedExpenses.length ? (
                <div className="operations-related-list">
                  {issue.relatedExpenses.map((expense) => (
                    <div key={expense.id}>
                      <span>{formatDateOnlyLocale(expense.expenseDate, locale)}</span>
                      <strong>{expense.description}</strong>
                      <small>{localizedCategoryLabel(expense.category)}</small>
                      <b>{formatVndLocale(expense.amountVnd, locale)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="operations-muted">{t("noRelatedOwnerCosts")}</p>
              )}
            </section>
          )}

          {activeTab === "HISTORY" && (
            <section className="operations-detail-section">
              <div className="operations-section-heading-inline">
                <h3>{t("history")}</h3>
                <span>{historyEvents.length}</span>
              </div>
              <div className="operations-history-list">
                {historyEvents.map((event) => (
                  <div key={event.id} className="operations-history-item">
                    <span className="operations-history-dot" aria-hidden="true" />
                    <div>
                      <strong>{event.title}</strong>
                      {event.detail && <p>{event.detail}</p>}
                    </div>
                    <time>{formatDateOnlyLocale(event.date, locale)}</time>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="operations-detail-danger">
          <PreservingActionForm action={archiveAction}>
            <input type="hidden" name="issueId" value={issue.id} />
            <Button type="submit" variant="ghost"><Archive /> {t("archiveIssue")}</Button>
          </PreservingActionForm>
          <ActionDialogState state={archiveState} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompleteMaintenanceDialog({ issue }: { issue: MaintenanceListItemView }) {
  const t = useTranslations("operations");
  const [open, setOpen] = React.useState(false);
  const [includeCost, setIncludeCost] = React.useState(false);
  const [state, action] = useDialogAction(completeMaintenanceAction, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button"><Check /> {t("complete")}</Button>
      </DialogTrigger>
      <DialogContent className="operations-dialog">
        <DialogHeader>
          <DialogTitle>{t("completeMaintenance")}</DialogTitle>
          <DialogDescription>{t("completeMaintenanceDescription")}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="issueId" value={issue.id} />
          <TextareaField label={t("resolution")} name="resolution" required />
          <Field label={t("completedDate")} name="completedAt" type="date" defaultValue={todayDate()} required />
          <label className="operations-check-row">
            <input type="checkbox" checked={includeCost} onChange={(event) => setIncludeCost(event.target.checked)} />
            <span>
              <strong>{t("recordMaintenanceCost")}</strong>
              <small>{t("createLinkedExpenseSameTransaction")}</small>
            </span>
          </label>
          {includeCost && (
            <div className="operations-cost-panel">
              <div className="operations-form-grid">
                <Field label={t("costVnd")} name="cost" type="number" min="1" step="1" required />
                <SelectField label={t("expenseCategory")} name="expenseCategory" defaultValue="REPAIR" required>
                  <option value="REPAIR">{t("repair")}</option>
                  <option value="UTILITIES">{t("utilitiesCategory")}</option>
                  <option value="CLEANING">{t("cleaning")}</option>
                  <option value="SUPPLIES">{t("supplies")}</option>
                  <option value="OTHER">{t("other")}</option>
                </SelectField>
              </div>
              <Field label={t("expenseDate")} name="expenseDate" type="date" defaultValue={todayDate()} required />
              <Field
                label={t("expenseDescriptionOptional")}
                name="expenseDescription"
                placeholder={t("maintenanceExpensePlaceholder", { title: issue.title })}
              />
              <TextareaField label={t("expenseNotesOptional")} name="expenseNotes" />
            </div>
          )}
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit"><Check /> {t("completeMaintenance")}</Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function MaintenancePhotoUpload({
  propertyId,
  issueId,
  existingCount = 0,
}: {
  propertyId: string;
  issueId: string;
  existingCount?: number;
}) {
  const t = useTranslations("operations");
  const router = useRouter();
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await addMaintenancePhotosAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  return (
    <PreservingActionForm action={action} className="operations-photo-upload">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="issueId" value={issueId} />
      <PrivateAttachmentPicker
        title={t("maintenancePhotos")}
        name="photos"
        accept="image/jpeg,image/png,image/webp"
        multiple
        required
        existingCount={existingCount}
        emptyText={t("noPhotosAttached")}
        actionLabel={t("addPhotos")}
        kind="image"
      />
      <Button type="submit" size="sm" variant="outline"><Camera /> {t("uploadSelected")}</Button>
      <ActionDialogState state={state} />
    </PreservingActionForm>
  );
}

function MaintenancePhotoGallery({ issue }: { issue: MaintenanceListItemView }) {
  const t = useTranslations("operations");
  const [index, setIndex] = React.useState(0);
  const photo = issue.photos[index];
  const router = useRouter();
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await removeMaintenancePhotoAction(previous, data);
      if (result.ok) {
        setIndex((current) => Math.max(0, Math.min(current, issue.photos.length - 2)));
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  if (!photo) return null;
  return (
    <div className="operations-photo-gallery">
      <div className="operations-photo-stage">
        {/* protected application route */}
        <img src={photo.url} alt={t("maintenanceEvidenceAlt", { index: index + 1 })} />
        {issue.photos.length > 1 && (
          <>
            <button
              type="button"
              className="operations-photo-nav is-prev"
              aria-label={t("previousPhoto")}
              onClick={() => setIndex((index - 1 + issue.photos.length) % issue.photos.length)}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="operations-photo-nav is-next"
              aria-label={t("nextPhoto")}
              onClick={() => setIndex((index + 1) % issue.photos.length)}
            >
              <ChevronRight />
            </button>
          </>
        )}
        <span className="operations-photo-count">{index + 1} / {issue.photos.length}</span>
      </div>
      <div className="operations-photo-thumbs">
        {issue.photos.map((item, photoIndex) => (
          <button
            type="button"
            key={item.id}
            className={photoIndex === index ? "is-active" : ""}
            onClick={() => setIndex(photoIndex)}
            aria-label={t("viewPhotoNumber", { index: photoIndex + 1 })}
          >
            <img src={item.url} alt="" />
          </button>
        ))}
      </div>
      {issue.status !== "COMPLETED" && (
        <PreservingActionForm action={action} className="operations-photo-remove">
          <input type="hidden" name="issueId" value={issue.id} />
          <input type="hidden" name="photoId" value={photo.id} />
          <Button type="submit" size="sm" variant="ghost"><Trash2 /> {t("removeCurrentPhoto")}</Button>
        </PreservingActionForm>
      )}
      <ActionDialogState state={state} />
    </div>
  );
}

export function ExpenseActions({
  propertyId,
  expense,
  locations,
  maintenanceOptions,
  assetOptions = [],
}: {
  propertyId: string;
  expense: ExpenseListItemView;
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  assetOptions?: OperationsAssetOption[];
}) {
  const t = useTranslations("operations");
  const router = useRouter();
  const [state, archiveAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await archiveExpenseAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const [receiptState, receiptAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await removeExpenseReceiptAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const menuRef = React.useRef<HTMLDetailsElement>(null);
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  return (
    <details ref={menuRef} className="operations-row-menu">
      <summary aria-label={t("actionsFor", { name: expense.description })}>•••</summary>
      <div onClick={(event) => { if ((event.target as HTMLElement).closest("button,a")) queueMicrotask(closeMenu); }}>
        <ExpenseFormDialog
          propertyId={propertyId}
          expense={expense}
          locations={locations}
          maintenanceOptions={maintenanceOptions}
          assetOptions={assetOptions}
          trigger={<button type="button"><Pencil /> {t("editExpense")}</button>}
        />
        {expense.hasReceipt && (
          <>
            <ExpenseReceiptViewer expense={expense} trigger={<button type="button"><Eye /> {t("viewCurrentReceipt")}</button>} />
            <PreservingActionForm action={receiptAction}>
              <input type="hidden" name="expenseId" value={expense.id} />
              <button type="submit"><Trash2 /> {t("removeReceipt")}</button>
            </PreservingActionForm>
          </>
        )}
        <div className="operations-menu-separator" />
        <PreservingActionForm action={archiveAction}>
          <input type="hidden" name="expenseId" value={expense.id} />
          <button type="submit" className="is-danger"><Archive /> {t("archive")}</button>
        </PreservingActionForm>
        {(state.message || receiptState.message) && (
          <span className="operations-menu-message">{state.message || receiptState.message}</span>
        )}
      </div>
    </details>
  );
}

export function TaskActions({
  propertyId,
  task,
  locations,
  maintenanceOptions,
  invoiceOptions,
}: {
  propertyId: string;
  task: TaskListItemView;
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  invoiceOptions: OperationsInvoiceOption[];
}) {
  const t = useTranslations("operations");
  const router = useRouter();
  const [completeState, completeAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await completeTaskAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const [archiveState, archiveAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await archiveTaskAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  const menuRef = React.useRef<HTMLDetailsElement>(null);
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  if (task.status === "DONE") {
    return (
      <span className="operations-task-done-action">
        <Check /> {t("done")}
      </span>
    );
  }
  return (
    <div className="operations-task-actions">
      <PreservingActionForm action={completeAction}>
        <input type="hidden" name="taskId" value={task.id} />
        <Button type="submit" size="sm"><Check /> {t("complete")}</Button>
      </PreservingActionForm>
      <details ref={menuRef} className="operations-row-menu">
        <summary aria-label={t("actionsFor", { name: task.title })}>•••</summary>
        <div onClick={(event) => { if ((event.target as HTMLElement).closest("button,a")) queueMicrotask(closeMenu); }}>
          <TaskFormDialog
            propertyId={propertyId}
            task={task}
            locations={locations}
            maintenanceOptions={maintenanceOptions}
            invoiceOptions={invoiceOptions}
            trigger={<button type="button"><Pencil /> {t("editTask")}</button>}
          />
          <div className="operations-menu-separator" />
          <PreservingActionForm action={archiveAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="is-danger"><Archive /> {t("archive")}</button>
          </PreservingActionForm>
        </div>
      </details>
      {(completeState.message && !completeState.ok) || (archiveState.message && !archiveState.ok) ? (
        <span className="operations-inline-error">{completeState.message || archiveState.message}</span>
      ) : null}
    </div>
  );
}

export function ExpenseReceiptIndicator({ expense }: { expense: ExpenseListItemView }) {
  if (!expense.hasReceipt) return <span className="operations-muted">—</span>;
  return <ExpenseReceiptViewer expense={expense} />;
}

function ExpenseReceiptViewer({ expense, trigger }: { expense: ExpenseListItemView; trigger?: React.ReactNode }) {
  const t = useTranslations("operations");
  const locale = useLocale() as AppLocale;
  const url = `/api/operations/expenses/${expense.id}/receipt`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <button type="button" className="operations-receipt-link"><ImageIcon /> {t("view")}</button>}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-receipt-dialog">
        <DialogHeader>
          <DialogTitle>{t("expenseReceipt")}</DialogTitle>
          <DialogDescription>{expense.description} · {formatDateOnlyLocale(expense.expenseDate, locale)}</DialogDescription>
        </DialogHeader>
        {expense.receiptMediaType === "pdf" ? (
          <iframe
            className="operations-receipt-frame"
            src={url}
            title={t("receiptFor", { name: expense.description })}
          />
        ) : (
          <div className="operations-receipt-image-wrap">
            {/* Protected same-origin image route; using img avoids the browser's
                generated image-document iframe and its CSP console noise. */}
            <img
              className="operations-receipt-image"
              src={url}
              alt={t("receiptFor", { name: expense.description })}
            />
          </div>
        )}
        <DialogFooter>
          <Button asChild variant="outline"><a href={url} target="_blank" rel="noreferrer"><Eye /> {t("openOriginal")}</a></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskRecurrence({ task }: { task: TaskListItemView }) {
  const t = useTranslations("operations");
  const interval = task.recurrenceInterval;
  const label = !task.recurrenceUnit || !interval
    ? t("oneTime")
    : task.recurrenceUnit === "DAYS"
      ? t("everyDays", { count: interval })
      : task.recurrenceUnit === "MONTHS"
        ? t("everyMonths", { count: interval })
        : t("everyYears", { count: interval });
  return <span className="operations-recurrence">{label}</span>;
}
