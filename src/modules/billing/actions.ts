"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import {
  finalizeInvoice,
  generateAllReady,
  generateInvoice,
  updateDraftLine,
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
  success: string,
): Promise<ActionState> {
  try {
    await work();
    revalidatePath("/billing/invoices");
    revalidatePath("/billing/payments");
    revalidatePath("/billing/deposits");
    return { ok: true, message: success };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not save billing changes.",
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
      ),
    "Draft invoice generated.",
  );
}
export async function generateAllReadyAction(_: ActionState, data: FormData) {
  return action(
    () =>
      generateAllReady(text(data, "propertyId"), text(data, "billingPeriod")),
    "All ready invoices generated.",
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
    "Invoice line updated.",
  );
}
export async function finalizeInvoiceAction(_: ActionState, data: FormData) {
  return action(
    () => finalizeInvoice(text(data, "invoiceId")),
    "Invoice finalized.",
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
    "Payment recorded.",
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
    "Payment updated.",
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
    "Deposit transaction recorded.",
  );
}
