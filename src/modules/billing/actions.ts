"use server";

import { revalidatePath } from "next/cache";
import { getActionFeedback } from "@/i18n/action-feedback";
import type { ActionState } from "@/lib/action-state";
import {
  addInvoiceAdjustment,
  deleteInvoiceAdjustment,
  finalizeInvoice,
  generateAllReady,
  generateInvoice,
  updateDraftLine,
  updateInvoiceAdjustment,
} from "./server/billing.service";
import { recordPayment, updatePayment } from "./server/payment.service";
import {
  addDepositDeduction,
  applyDepositToInvoice,
  recordDepositReceipt,
  refundDeposit,
} from "./server/deposit.service";

const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
async function action(
  work: () => Promise<unknown>,
  successKey: string,
): Promise<ActionState> {
  const feedback = await getActionFeedback("billing");
  try {
    await work();
    revalidatePath("/billing/invoices");
    revalidatePath("/billing/payments");
    revalidatePath("/billing/deposits");
    return { ok: true, message: feedback(successKey) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : feedback("saveFailed"),
    };
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
export async function addInvoiceAdjustmentAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      addInvoiceAdjustment(text(data, "invoiceId"), {
        type: text(data, "type") as "CHARGE" | "CREDIT",
        description: text(data, "description"),
        amount: text(data, "amount"),
        reason: text(data, "reason"),
      }),
    "adjustmentAdded",
  );
}
export async function updateInvoiceAdjustmentAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      updateInvoiceAdjustment(
        text(data, "invoiceId"),
        text(data, "adjustmentId"),
        {
          type: text(data, "type") as "CHARGE" | "CREDIT",
          description: text(data, "description"),
          amount: text(data, "amount"),
          reason: text(data, "reason"),
        },
      ),
    "adjustmentUpdated",
  );
}
export async function deleteInvoiceAdjustmentAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      deleteInvoiceAdjustment(
        text(data, "invoiceId"),
        text(data, "adjustmentId"),
      ),
    "adjustmentRemoved",
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
