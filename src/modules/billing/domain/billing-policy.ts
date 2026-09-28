import {
  monthEndExclusive,
  monthStart,
} from "@/modules/utilities/domain/rules";

export type BillingPolicyPeriods = {
  invoiceMonth: Date;
  rentPeriod: { start: Date; end: Date };
  utilityBillingMonth: Date;
};

export type UtilityBillingTiming =
  "PREVIOUS_COMPLETED_MONTH" | "SAME_COMPLETED_MONTH";

export type BillingPolicy = {
  utilityBillingTiming: UtilityBillingTiming;
};

export const billingPolicy: BillingPolicy = {
  utilityBillingTiming: "PREVIOUS_COMPLETED_MONTH",
};

/** Current policy source-period resolver. A future effective-dated policy can
 * replace this implementation without changing invoice persistence or UI. */
export function resolveRegularBillingPeriods(
  invoiceMonth: Date,
  policy: BillingPolicy = billingPolicy,
): BillingPolicyPeriods {
  const normalized = monthStart(invoiceMonth);
  const utilityBillingMonth = resolveDefaultUtilityBillingMonth(
    normalized,
    policy,
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

export function resolveDefaultUtilityBillingMonth(
  referenceDate: Date,
  policy: BillingPolicy = billingPolicy,
) {
  const normalized = monthStart(referenceDate);
  if (policy.utilityBillingTiming === "SAME_COMPLETED_MONTH") {
    return normalized;
  }
  return new Date(
    Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() - 1, 1),
  );
}
