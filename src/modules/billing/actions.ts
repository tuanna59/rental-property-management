"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActionFeedback } from "@/i18n/action-feedback";
import type { ActionState } from "@/lib/action-state";
import {
  addDraftInvoiceAdjustment,
  addFinalizedInvoiceAdjustment,
  finalizeInvoice,
  generateAllReady,
  generateInvoice,
  updateDraftInvoiceAdjustment,
  updateDraftLine,
  removeDraftInvoiceAdjustment,
  voidInvoice,
  correctInvoice,
} from "./server/billing.service";
import { BillingDomainError } from "./domain/errors";
import { recordPayment, updatePayment } from "./server/payment.service";
import {
  addDepositDeduction,
  applyDepositToInvoice,
  recordDepositReceipt,
  refundDeposit,
} from "./server/deposit.service";

const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
function revalidateBillingViews() {
  revalidatePath("/billing/invoices");
  revalidatePath("/billing/invoices/[invoiceId]", "page");
  revalidatePath("/billing/payments");
  revalidatePath("/billing/deposits");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/utilities");
  revalidatePath("/utilities/meters");
}

function billingErrorMessage(
  error: unknown,
  feedback: (key: string, values?: Record<string, string | number | Date>) => string,
) {
  if (error instanceof BillingDomainError) {
    const key = {
      VOID_REASON_REQUIRED: "voidReasonRequired",
      INVOICE_NOT_FINALIZED: "voidFinalizedOnly",
      INVOICE_ALREADY_VOIDED: "invoiceAlreadyVoided",
      INVOICE_HAS_PAYMENTS: "invoiceHasPaymentsCannotVoid",
      CORRECTION_ALREADY_EXISTS: "correctionAlreadyExists",
      ACTIVE_INVOICE_EXISTS: "activeInvoiceExists",
      INVOICE_HAS_ADJUSTMENTS: "invoiceHasAdjustmentsCannotVoid",
      ADJUSTMENT_REASON_REQUIRED: "adjustmentReasonRequired",
      ADJUSTMENT_FINALIZED_ONLY: "adjustmentFinalizedOnly",
      ADJUSTMENT_OVERPAYMENT: "adjustmentWouldOverpay",
      ADJUSTMENT_IMMUTABLE: "adjustmentImmutable",
      DRAFT_ADJUSTMENT_ONLY: "draftAdjustmentOnly",
      DRAFT_ADJUSTMENT_EXISTS: "draftAdjustmentExists",
      DRAFT_ADJUSTMENT_NOT_FOUND: "draftAdjustmentNotFound",
    }[error.code];
    return feedback(key);
  }
  return error instanceof Error ? error.message : feedback("saveFailed");
}

async function action(
  work: () => Promise<unknown>,
  successKey: string,
): Promise<ActionState> {
  const feedback = await getActionFeedback("billing");
  try {
    await work();
    revalidateBillingViews();
    return { ok: true, message: feedback(successKey) };
  } catch (error) {
    return { ok: false, message: billingErrorMessage(error, feedback) };
  }
}

export async function generateInvoiceAction(_: ActionState, data: FormData) {
  return action(
    () =>
      generateInvoice(
        text(data, "propertyId"),
        text(data, "tenancyId"),
        text(data, "billingPeriod"),
        text(data, "invoiceType") as "REGULAR" | "FINAL_SETTLEMENT",
      ),
    "draftGenerated",
  );
}
export async function addDraftInvoiceAdjustmentAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      addDraftInvoiceAdjustment(text(data, "invoiceId"), {
        direction: text(data, "direction") as "DECREASE" | "INCREASE",
        amount: text(data, "amount"),
        reason: text(data, "reason"),
      }),
    "draftAdjustmentAdded",
  );
}

export async function updateDraftInvoiceAdjustmentAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      updateDraftInvoiceAdjustment(
        text(data, "invoiceId"),
        text(data, "lineId"),
        {
          direction: text(data, "direction") as "DECREASE" | "INCREASE",
          amount: text(data, "amount"),
          reason: text(data, "reason"),
        },
      ),
    "draftAdjustmentUpdated",
  );
}

export async function removeDraftInvoiceAdjustmentAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      removeDraftInvoiceAdjustment(
        text(data, "invoiceId"),
        text(data, "lineId"),
      ),
    "draftAdjustmentRemoved",
  );
}

export async function addFinalizedInvoiceAdjustmentAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      addFinalizedInvoiceAdjustment(text(data, "invoiceId"), {
        type: text(data, "type") as "CREDIT" | "DEBIT",
        amount: text(data, "amount"),
        reason: text(data, "reason"),
      }),
    "billingAdjustmentAdded",
  );
}

export async function generateAllReadyAction(_: ActionState, data: FormData) {
  return action(
    () =>
      generateAllReady(text(data, "propertyId"), text(data, "billingPeriod")),
    "allReadyGenerated",
  );
}
export async function overrideInvoiceLineAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      updateDraftLine(
        text(data, "invoiceId"),
        text(data, "lineId"),
        text(data, "finalAmount"),
        text(data, "overrideReason"),
      ),
    "lineUpdated",
  );
}
export async function finalizeInvoiceAction(_: ActionState, data: FormData) {
  return action(
    () => finalizeInvoice(text(data, "invoiceId")),
    "invoiceFinalized",
  );
}
export async function voidInvoiceAction(_: ActionState, data: FormData) {
  return action(
    () => voidInvoice(text(data, "invoiceId"), text(data, "reason")),
    "invoiceVoided",
  );
}

export async function correctInvoiceAction(
  _: ActionState,
  data: FormData,
): Promise<ActionState> {
  const feedback = await getActionFeedback("billing");
  let replacementId: string;
  try {
    const replacement = await correctInvoice(
      text(data, "invoiceId"),
      text(data, "reason"),
    );
    replacementId = replacement.id;
    revalidateBillingViews();
  } catch (error) {
    return { ok: false, message: billingErrorMessage(error, feedback) };
  }
  redirect(`/billing/invoices/${replacementId}`);
}

export async function recordPaymentAction(_: ActionState, data: FormData) {
  return action(
    () =>
      recordPayment({
        invoiceId: text(data, "invoiceId"),
        amount: text(data, "amount"),
        paymentDate: text(data, "paymentDate"),
        method: text(data, "method") as "CASH" | "BANK_TRANSFER" | "OTHER",
        reference: text(data, "reference") || undefined,
        notes: text(data, "notes") || undefined,
      }),
    "paymentRecorded",
  );
}
export async function updatePaymentAction(_: ActionState, data: FormData) {
  return action(
    () =>
      updatePayment(text(data, "paymentId"), {
        amount: text(data, "amount"),
        paymentDate: text(data, "paymentDate"),
        method: text(data, "method") as "CASH" | "BANK_TRANSFER" | "OTHER",
        reference: text(data, "reference") || undefined,
        notes: text(data, "notes") || undefined,
      }),
    "paymentUpdated",
  );
}
export async function depositTransactionAction(_: ActionState, data: FormData) {
  const input = {
    tenancyId: text(data, "tenancyId"),
    amount: text(data, "amount"),
    transactionDate: text(data, "transactionDate"),
    reference: text(data, "reference") || undefined,
    notes: text(data, "notes") || undefined,
  };
  const kind = text(data, "kind");
  return action(
    () =>
      kind === "RECEIPT"
        ? recordDepositReceipt(input)
        : kind === "REFUND"
          ? refundDeposit(input)
          : kind === "DEDUCTION"
            ? addDepositDeduction({
                ...input,
                category: text(data, "category") as
                  "DAMAGE" | "CLEANING" | "OUTSTANDING_INVOICE" | "OTHER",
              })
            : applyDepositToInvoice({
                ...input,
                invoiceId: text(data, "invoiceId"),
              }),
    "depositTransactionRecorded",
  );
}
