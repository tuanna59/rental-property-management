import type { AppLocale } from "@/i18n/config";
import {
  formatMonthAxisLocale,
  formatMonthLocale,
  formatMonthShortLocale,
  formatPercentLocale,
  formatVndLocale,
} from "@/i18n/format";

type FinancialChartLabels = {
  billed: string;
  collected: string;
  expenses: string;
  ariaLabel: string;
};

export function FinancialTrendLegend({
  labels,
  compact = false,
}: {
  labels: Pick<FinancialChartLabels, "billed" | "collected" | "expenses">;
  compact?: boolean;
}) {
  return (
    <div className={`analytics-chart-legend${compact ? " is-compact" : ""}`}>
      <span><i className="series-billed" />{labels.billed}</span>
      <span><i className="series-collected" />{labels.collected}</span>
      <span><i className="series-expenses" />{labels.expenses}</span>
    </div>
  );
}

export function FinancialTrendChart({
  points,
  locale,
  labels,
  compact = false,
  hideLegend = false,
  showYearOnAxis = true,
}: {
  points: Array<{ month?: string; label: string; billedVnd: string; collectedVnd: string; expensesVnd: string }>;
  locale: AppLocale;
  labels: FinancialChartLabels;
  compact?: boolean;
  hideLegend?: boolean;
  showYearOnAxis?: boolean;
}) {
  const max = Math.max(
    1,
    ...points.flatMap((point) => [Number(point.billedVnd), Number(point.collectedVnd), Number(point.expensesVnd)]),
  );

  return (
    <div className={`analytics-chart${compact ? " is-compact" : ""}`} role="img" aria-label={labels.ariaLabel}>
      {!hideLegend ? <FinancialTrendLegend labels={labels} /> : null}
      <div className={`analytics-bar-grid${compact ? " is-compact" : ""}`} style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point) => {
          const monthLabel = point.month ? (showYearOnAxis ? formatMonthShortLocale(point.month, locale) : formatMonthAxisLocale(point.month, locale)) : point.label;
          const monthLong = point.month ? formatMonthLocale(point.month, locale) : point.label;
          return (
            <div className="analytics-bar-month" key={point.month ?? point.label} tabIndex={0}>
              <div className="analytics-bar-group">
                <Bar value={Number(point.billedVnd)} max={max} className="series-billed" />
                <Bar value={Number(point.collectedVnd)} max={max} className="series-collected" />
                <Bar value={Number(point.expensesVnd)} max={max} className="series-expenses" />
              </div>
              <span>{monthLabel}</span>
              <div className="analytics-chart-tooltip" role="tooltip">
                <strong>{monthLong}</strong>
                <span><i className="series-billed" />{labels.billed}<b>{formatVndLocale(point.billedVnd, locale)}</b></span>
                <span><i className="series-collected" />{labels.collected}<b>{formatVndLocale(point.collectedVnd, locale)}</b></span>
                <span><i className="series-expenses" />{labels.expenses}<b>{formatVndLocale(point.expensesVnd, locale)}</b></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const height = value <= 0 ? 2 : Math.max(4, (value / max) * 100);
  return <i className={`analytics-bar ${className}`} style={{ height: `${height}%` }} />;
}

export function OccupancyTrendChart({
  points,
  locale,
  ariaLabel,
}: {
  points: Array<{ month?: string; label: string; occupancyRate: number }>;
  locale: AppLocale;
  ariaLabel: string;
}) {
  return (
    <div className="occupancy-trend-chart" role="img" aria-label={ariaLabel}>
      {points.map((point) => {
        const label = point.month ? formatMonthAxisLocale(point.month, locale) : point.label;
        const longLabel = point.month ? formatMonthLocale(point.month, locale) : point.label;
        return (
          <div key={point.month ?? point.label} className="occupancy-trend-column" tabIndex={0}>
            <div><i style={{ height: `${Math.max(2, point.occupancyRate)}%` }} /></div>
            <span>{label}</span>
            <div className="analytics-chart-tooltip occupancy-tooltip" role="tooltip">
              <strong>{longLabel}</strong>
              <span><b>{formatPercentLocale(point.occupancyRate, locale)}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExpenseCategoryBars({
  points,
  locale,
  labelForCategory,
  emptyText,
}: {
  points: Array<{ category: string; amountVnd: string }>;
  locale: AppLocale;
  labelForCategory: (value: string) => string;
  emptyText: string;
}) {
  const max = Math.max(1, ...points.map((point) => Number(point.amountVnd)));
  return (
    <div className="expense-category-bars">
      {points.length ? points.map((point) => (
        <div className="expense-category-row" key={point.category}>
          <span>{labelForCategory(point.category)}</span>
          <div><i style={{ width: `${Math.max(2, (Number(point.amountVnd) / max) * 100)}%` }} /></div>
          <strong>{formatVndLocale(point.amountVnd, locale)}</strong>
        </div>
      )) : <p className="analytics-inline-empty">{emptyText}</p>}
    </div>
  );
}
