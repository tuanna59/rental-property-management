import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale } from "@/i18n/format";
import type { useTranslations } from "next-intl";

export type UtilitiesTranslator = ReturnType<typeof useTranslations<"utilities">>;

export function translateUtilityWarning(
  warning: string,
  t: UtilitiesTranslator,
  locale: AppLocale,
) {
  if (warning === "Monthly closing reading is estimated.") return t("monthlyClosingEstimated");
  if (warning === "Monthly closing is required for this room.") return t("monthlyClosingRequired");
  if (warning === "Missing opening reading for this physical meter segment.") return t("missingOpeningReading");
  if (warning === "Readings decrease inside this physical meter segment.") return t("readingDecreased");
  if (warning === "Recorded before the month ended. You can replace it with a later reading.") return t("recordedBeforeMonthEnd");
  if (warning === "Monthly closing is not ready for billing.") return t("monthlyClosingNotReady");
  if (warning === "Electricity attribution is incomplete.") return t("electricityAttributionIncomplete");
  if (warning === "No electricity rate is configured.") return t("noElectricityRateConfigured");

  const moveMatch = warning.match(/^Missing move-(in|out) reading for (.+) on (\d{4}-\d{2}-\d{2})$/);
  if (moveMatch) {
    return t(moveMatch[1] === "in" ? "missingMoveInReading" : "missingMoveOutReading", {
      tenant: moveMatch[2],
      date: formatDateOnlyLocale(moveMatch[3], locale),
    });
  }

  const afterMatch = warning.match(/^This reading was taken (\d+) days? after the month ended/);
  if (afterMatch) return t("lateClosingDetail", { days: Number(afterMatch[1]) });
  const beforeMatch = warning.match(/^This reading was taken (\d+) days? before the month ended/);
  if (beforeMatch) return t("earlyClosingDetail");
  return warning;
}
