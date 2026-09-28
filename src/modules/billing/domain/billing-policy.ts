import {
  monthEndExclusive,
  monthStart,
} from "@/modules/utilities/domain/rules";

export type BillingPolicyPeriods = {
  invoiceMonth: Date;
  rentPeriod: { start: Date; end: Date };
  utilityBillingMonth: Date;
};

/** Current policy source-period resolver. A future effective-dated policy can
 * replace this implementation without changing invoice persistence or UI. */
export function resolveRegularBillingPeriods(
  invoiceMonth: Date,
): BillingPolicyPeriods {
  const normalized = monthStart(invoiceMonth);
  const utilityBillingMonth = new Date(
    Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() - 1, 1),
  );
  return {
    invoiceMonth: normalized,
    rentPeriod: {
      start: normalized,
      end: monthEndExclusive(normalized),
    },
    utilityBillingMonth,
  };
}
