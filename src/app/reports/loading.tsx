import { getTranslations } from "next-intl/server";

import "@/modules/analytics/components/analytics.css";

export default async function ReportsLoading() {
  const t = await getTranslations("reports");
  return (
    <main className="analytics-page analytics-loading-page" aria-label={t("loading")}>
      <div className="analytics-loading-header"><i /><i /></div>
      <div className="analytics-loading-tabs"><i /><i /><i /><i /><i /><i /></div>
      <div className="analytics-loading-grid">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      <div className="analytics-loading-table" />
    </main>
  );
}
