"use client";

import * as React from "react";
import {
  Archive,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePlus2,
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
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { formatDate, formatVnd } from "@/lib/presentation";

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
  OperationsInvoiceOption,
  OperationsLocationOption,
  TaskListItemView,
} from "../domain/types";
import {
  categoryLabel,
  OperationsPriorityBadge,
  OperationsStatusBadge,
  recurrenceLabel,
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
  onChange,
  value,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  required?: boolean;
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
  const inferredFloor =
    defaultFloorId ||
    locations.find((location) => location.spaceId === defaultSpaceId)?.floorId ||
    "";
  const [floorId, setFloorId] = React.useState(inferredFloor);
  const floorOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const location of locations) seen.set(location.floorId, location.floorName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [locations]);
  const roomOptions = floorId
    ? locations.filter((location) => location.floorId === floorId)
    : locations;

  return (
    <div className="operations-form-grid">
      <SelectField
        label="Floor (optional)"
        name="floorId"
        value={floorId}
        onChange={(event) => setFloorId(event.target.value)}
      >
        <option value="">Property level</option>
        {floorOptions.map((floor) => (
          <option key={floor.id} value={floor.id}>
            {floor.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        key={`${floorId}-${defaultSpaceId ?? ""}`}
        label="Room / space (optional)"
        name="spaceId"
        defaultValue={defaultSpaceId ?? ""}
      >
        <option value="">{floorId ? "Floor level" : "Property level"}</option>
        {roomOptions.map((location) => (
          <option key={location.spaceId} value={location.spaceId}>
            {location.spaceName} · {location.floorName}
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
  expense,
  trigger,
}: {
  propertyId: string;
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  expense?: ExpenseListItemView;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const serverAction = expense ? updateExpenseAction : createExpenseAction;
  const [state, action] = useDialogAction(serverAction, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Add expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-dialog-wide">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            Record an actual owner/property cost. Expense amounts are kept exactly as entered.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {expense && <input type="hidden" name="expenseId" value={expense.id} />}
          <div className="operations-form-grid">
            <Field
              label="Date"
              name="expenseDate"
              type="date"
              defaultValue={expense?.expenseDate ?? todayDate()}
              required
            />
            <SelectField
              label="Category"
              name="category"
              defaultValue={expense?.category ?? "REPAIR"}
              required
            >
              <option value="REPAIR">Repair</option>
              <option value="UTILITIES">Utilities</option>
              <option value="CLEANING">Cleaning</option>
              <option value="SUPPLIES">Supplies</option>
              <option value="OTHER">Other</option>
            </SelectField>
          </div>
          <div className="operations-form-grid">
            <Field
              label="Amount (VND)"
              name="amount"
              type="number"
              min="1"
              step="1"
              defaultValue={expense?.amountVnd ?? ""}
              required
            />
            <Field
              label="Description"
              name="description"
              defaultValue={expense?.description ?? ""}
              required
            />
          </div>
          <LocationFields
            locations={locations}
            defaultFloorId={expense?.floorId}
            defaultSpaceId={expense?.spaceId}
          />
          <SelectField
            label="Linked maintenance (optional)"
            name="maintenanceIssueId"
            defaultValue={expense?.maintenanceIssueId ?? ""}
          >
            <option value="">No linked issue</option>
            {maintenanceOptions.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issue.title} · {issue.locationLabel}
              </option>
            ))}
          </SelectField>
          <div className="operations-form-grid">
            <Field
              label={expense?.hasReceipt ? "Replace receipt (optional)" : "Receipt (optional)"}
              name="receipt"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
            <TextareaField label="Notes (optional)" name="notes" defaultValue={expense?.notes ?? ""} />
          </div>
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit">
              <ReceiptText /> {expense ? "Save expense" : "Record expense"}
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
  issue,
  trigger,
}: {
  propertyId: string;
  locations: OperationsLocationOption[];
  issue?: MaintenanceListItemView;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const serverAction = issue ? updateMaintenanceAction : createMaintenanceAction;
  const [state, action] = useDialogAction(serverAction, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Report issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-dialog-wide">
        <DialogHeader>
          <DialogTitle>{issue ? "Edit maintenance issue" : "Report maintenance issue"}</DialogTitle>
          <DialogDescription>
            Capture the problem, location, priority, and any useful evidence.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {issue && <input type="hidden" name="issueId" value={issue.id} />}
          <Field label="Issue title" name="title" defaultValue={issue?.title ?? ""} required />
          <TextareaField
            label="Description"
            name="description"
            defaultValue={issue?.description ?? ""}
            required
          />
          <div className="operations-form-grid">
            <SelectField
              label="Priority"
              name="priority"
              defaultValue={issue?.priority ?? "MEDIUM"}
              required
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </SelectField>
            <Field
              label="Reported date"
              name="reportedAt"
              type="date"
              defaultValue={issue?.reportedAt ?? todayDate()}
              required
            />
          </div>
          <LocationFields
            locations={locations}
            defaultFloorId={issue?.floorId}
            defaultSpaceId={issue?.spaceId}
          />
          <div className="operations-form-grid">
            <Field label="Reported by (optional)" name="reportedBy" defaultValue={issue?.reportedBy ?? ""} />
            <Field label="Assigned to (optional)" name="assignedTo" defaultValue={issue?.assignedTo ?? ""} />
          </div>
          <TextareaField label="Notes (optional)" name="notes" defaultValue={issue?.notes ?? ""} />
          {!issue && (
            <Field
              label="Photos (optional)"
              name="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
            />
          )}
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit">
              <Wrench /> {issue ? "Save issue" : "Report issue"}
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
}: {
  propertyId: string;
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
  invoiceOptions: OperationsInvoiceOption[];
  task?: TaskListItemView;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [linkType, setLinkType] = React.useState<string>(task?.linkedEntityType ?? "");
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
            <Plus /> Add task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-dialog-wide">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>
            Keep operational work lightweight. Recurring tasks create the next occurrence only when completed.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {task && <input type="hidden" name="taskId" value={task.id} />}
          <Field label="Title" name="title" defaultValue={task?.title ?? ""} required />
          <TextareaField label="Description (optional)" name="description" defaultValue={task?.description ?? ""} />
          <div className="operations-form-grid">
            <SelectField label="Priority" name="priority" defaultValue={task?.priority ?? "MEDIUM"} required>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </SelectField>
            <Field label="Due date (optional)" name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} />
          </div>
          <div className="operations-form-grid">
            <SelectField
              label="Linked context (optional)"
              name="linkedEntityType"
              value={linkType}
              onChange={(event) => setLinkType(event.target.value)}
            >
              <option value="">No link</option>
              <option value="PROPERTY">Property</option>
              <option value="SPACE">Room / space</option>
              <option value="MAINTENANCE">Maintenance issue</option>
              <option value="INVOICE">Invoice</option>
            </SelectField>
            {linkType && linkType !== "PROPERTY" ? (
              <SelectField
                key={`${linkType}-${task?.linkedEntityId ?? ""}`}
                label="Linked record"
                name="linkedEntityId"
                defaultValue={task?.linkedEntityType === linkType ? task.linkedEntityId ?? "" : ""}
                required
              >
                <option value="">Choose record</option>
                {linkedOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <div className="operations-form-context">
                <span>{linkType === "PROPERTY" ? "Linked to this property" : "No operational link"}</span>
              </div>
            )}
          </div>
          <div className="operations-form-grid">
            <SelectField
              label="Recurrence"
              name="recurrenceUnit"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
            >
              <option value="">One-time</option>
              <option value="DAYS">Every N days</option>
              <option value="MONTHS">Every N months</option>
              <option value="YEARS">Every N years</option>
            </SelectField>
            {recurrence ? (
              <Field
                label="Every"
                name="recurrenceInterval"
                type="number"
                min="1"
                step="1"
                defaultValue={task?.recurrenceInterval ?? 1}
                required
              />
            ) : (
              <div className="operations-form-context">
                <span>Complete once and keep the history.</span>
              </div>
            )}
          </div>
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit">
              <Check /> {task ? "Save task" : "Create task"}
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
  trigger,
}: {
  propertyId: string;
  issue: MaintenanceListItemView;
  locations: OperationsLocationOption[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" className="operations-view-button">
            <Eye /> View
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="operations-dialog operations-detail-dialog">
        <DialogHeader>
          <div className="operations-detail-title-row">
            <div>
              <DialogTitle>{issue.title}</DialogTitle>
              <DialogDescription>{issue.locationLabel} · Reported {formatDate(issue.reportedAt)}</DialogDescription>
            </div>
            <div className="operations-detail-badges">
              <OperationsPriorityBadge priority={issue.priority} />
              <OperationsStatusBadge status={issue.status} />
            </div>
          </div>
        </DialogHeader>

        <div className="operations-detail-meta">
          <div><span>Reported by</span><strong>{issue.reportedBy || "Not provided"}</strong></div>
          <div><span>Assigned to</span><strong>{issue.assignedTo || "Unassigned"}</strong></div>
          <div><span>Photos</span><strong>{issue.photoCount}</strong></div>
          <div><span>Related cost</span><strong>{formatVnd(issue.costVnd)}</strong></div>
        </div>

        <section className="operations-detail-section">
          <h3>Description</h3>
          <p>{issue.description}</p>
          {issue.notes && <div className="operations-note"><strong>Notes</strong><p>{issue.notes}</p></div>}
        </section>

        {issue.photos.length > 0 && (
          <section className="operations-detail-section">
            <div className="operations-section-heading-inline">
              <h3>Photos</h3>
              <span>{issue.photos.length} image{issue.photos.length === 1 ? "" : "s"}</span>
            </div>
            <MaintenancePhotoGallery issue={issue} />
          </section>
        )}

        {issue.status !== "COMPLETED" && (
          <section className="operations-detail-section operations-detail-actions-section">
            <h3>Work</h3>
            <div className="operations-detail-actions">
              {issue.status === "OPEN" && (
                <PreservingActionForm action={startAction} className="operations-inline-action">
                  <input type="hidden" name="issueId" value={issue.id} />
                  <Input name="assignedTo" defaultValue={issue.assignedTo ?? ""} placeholder="Assign to (optional)" />
                  <Button type="submit"><ArrowRight /> Start work</Button>
                </PreservingActionForm>
              )}
              {issue.status === "IN_PROGRESS" && (
                <CompleteMaintenanceDialog issue={issue} />
              )}
              <MaintenanceFormDialog
                propertyId={propertyId}
                locations={locations}
                issue={issue}
                trigger={<Button type="button" variant="outline"><Pencil /> Edit</Button>}
              />
            </div>
            <ActionDialogState state={startState} />
          </section>
        )}

        {issue.status === "COMPLETED" && (
          <section className="operations-detail-section operations-resolution">
            <h3>Resolution</h3>
            <p>{issue.resolution || "Completed"}</p>
            {issue.completedAt && <span>Completed {formatDate(issue.completedAt)}</span>}
          </section>
        )}

        <section className="operations-detail-section">
          <div className="operations-section-heading-inline">
            <h3>Related expenses</h3>
            <span>{issue.relatedExpenses.length}</span>
          </div>
          {issue.relatedExpenses.length ? (
            <div className="operations-related-list">
              {issue.relatedExpenses.map((expense) => (
                <div key={expense.id}>
                  <span>{formatDate(expense.expenseDate)}</span>
                  <strong>{expense.description}</strong>
                  <small>{categoryLabel(expense.category)}</small>
                  <b>{formatVnd(expense.amountVnd)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="operations-muted">No owner costs linked to this issue yet.</p>
          )}
        </section>

        <section className="operations-detail-section">
          <h3>Add photos</h3>
          <MaintenancePhotoUpload propertyId={propertyId} issueId={issue.id} />
        </section>

        <div className="operations-detail-danger">
          <PreservingActionForm action={archiveAction}>
            <input type="hidden" name="issueId" value={issue.id} />
            <Button type="submit" variant="ghost"><Archive /> Archive issue</Button>
          </PreservingActionForm>
          <ActionDialogState state={archiveState} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompleteMaintenanceDialog({ issue }: { issue: MaintenanceListItemView }) {
  const [open, setOpen] = React.useState(false);
  const [includeCost, setIncludeCost] = React.useState(false);
  const [state, action] = useDialogAction(completeMaintenanceAction, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button"><Check /> Complete</Button>
      </DialogTrigger>
      <DialogContent className="operations-dialog">
        <DialogHeader>
          <DialogTitle>Complete maintenance</DialogTitle>
          <DialogDescription>
            Close the issue and optionally record the actual owner cost as a linked expense.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="operations-form">
          <input type="hidden" name="issueId" value={issue.id} />
          <TextareaField label="Resolution" name="resolution" required />
          <Field label="Completed date" name="completedAt" type="date" defaultValue={todayDate()} required />
          <label className="operations-check-row">
            <input type="checkbox" checked={includeCost} onChange={(event) => setIncludeCost(event.target.checked)} />
            <span>
              <strong>Record maintenance cost</strong>
              <small>Create a linked Expense in the same transaction.</small>
            </span>
          </label>
          {includeCost && (
            <div className="operations-cost-panel">
              <div className="operations-form-grid">
                <Field label="Cost (VND)" name="cost" type="number" min="1" step="1" required />
                <SelectField label="Expense category" name="expenseCategory" defaultValue="REPAIR" required>
                  <option value="REPAIR">Repair</option>
                  <option value="UTILITIES">Utilities</option>
                  <option value="CLEANING">Cleaning</option>
                  <option value="SUPPLIES">Supplies</option>
                  <option value="OTHER">Other</option>
                </SelectField>
              </div>
              <Field label="Expense date" name="expenseDate" type="date" defaultValue={todayDate()} required />
              <Field label="Expense description (optional)" name="expenseDescription" placeholder={`Maintenance: ${issue.title}`} />
              <TextareaField label="Expense notes (optional)" name="expenseNotes" />
            </div>
          )}
          <ActionDialogState state={state} />
          <DialogFooter>
            <Button type="submit"><Check /> Complete issue</Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function MaintenancePhotoUpload({ propertyId, issueId }: { propertyId: string; issueId: string }) {
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
      <Input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required />
      <Button type="submit" size="sm" variant="outline"><Camera /> Add photos</Button>
      <ActionDialogState state={state} />
    </PreservingActionForm>
  );
}

function MaintenancePhotoGallery({ issue }: { issue: MaintenanceListItemView }) {
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
        <img src={photo.url} alt={`Maintenance evidence ${index + 1}`} />
        {issue.photos.length > 1 && (
          <>
            <button type="button" className="operations-photo-nav is-prev" aria-label="Previous photo" onClick={() => setIndex((index - 1 + issue.photos.length) % issue.photos.length)}>
              <ChevronLeft />
            </button>
            <button type="button" className="operations-photo-nav is-next" aria-label="Next photo" onClick={() => setIndex((index + 1) % issue.photos.length)}>
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
            aria-label={`View photo ${photoIndex + 1}`}
          >
            <img src={item.url} alt="" />
          </button>
        ))}
      </div>
      <PreservingActionForm action={action} className="operations-photo-remove">
        <input type="hidden" name="issueId" value={issue.id} />
        <input type="hidden" name="photoId" value={photo.id} />
        <Button type="submit" size="sm" variant="ghost"><Trash2 /> Remove current photo</Button>
      </PreservingActionForm>
      <ActionDialogState state={state} />
    </div>
  );
}

export function ExpenseActions({
  propertyId,
  expense,
  locations,
  maintenanceOptions,
}: {
  propertyId: string;
  expense: ExpenseListItemView;
  locations: OperationsLocationOption[];
  maintenanceOptions: Array<{ id: string; title: string; locationLabel: string }>;
}) {
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
  return (
    <details className="operations-row-menu">
      <summary aria-label={`Actions for ${expense.description}`}>•••</summary>
      <div>
        <ExpenseFormDialog
          propertyId={propertyId}
          expense={expense}
          locations={locations}
          maintenanceOptions={maintenanceOptions}
          trigger={<button type="button"><Pencil /> Edit expense</button>}
        />
        {expense.hasReceipt && (
          <>
            <a href={`/api/operations/expenses/${expense.id}/receipt`} target="_blank" rel="noreferrer"><Eye /> View receipt</a>
            <PreservingActionForm action={receiptAction}>
              <input type="hidden" name="expenseId" value={expense.id} />
              <button type="submit"><Trash2 /> Remove receipt</button>
            </PreservingActionForm>
          </>
        )}
        <div className="operations-menu-separator" />
        <PreservingActionForm action={archiveAction}>
          <input type="hidden" name="expenseId" value={expense.id} />
          <button type="submit" className="is-danger"><Archive /> Archive</button>
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
  if (task.status === "DONE") {
    return (
      <span className="operations-task-done-action">
        <Check /> Done
      </span>
    );
  }
  return (
    <div className="operations-task-actions">
      <PreservingActionForm action={completeAction}>
        <input type="hidden" name="taskId" value={task.id} />
        <Button type="submit" size="sm"><Check /> Complete</Button>
      </PreservingActionForm>
      <details className="operations-row-menu">
        <summary aria-label={`Actions for ${task.title}`}>•••</summary>
        <div>
          <TaskFormDialog
            propertyId={propertyId}
            task={task}
            locations={locations}
            maintenanceOptions={maintenanceOptions}
            invoiceOptions={invoiceOptions}
            trigger={<button type="button"><Pencil /> Edit task</button>}
          />
          <div className="operations-menu-separator" />
          <PreservingActionForm action={archiveAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="is-danger"><Archive /> Archive</button>
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
  return (
    <a
      className="operations-receipt-link"
      href={`/api/operations/expenses/${expense.id}/receipt`}
      target="_blank"
      rel="noreferrer"
    >
      <ImageIcon /> View
    </a>
  );
}

export function TaskRecurrence({ task }: { task: TaskListItemView }) {
  return <span className="operations-recurrence">{recurrenceLabel(task.recurrenceUnit, task.recurrenceInterval)}</span>;
}
