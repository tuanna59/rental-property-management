import { formatVnd } from "@/lib/presentation";

export function FinancialTrendLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`analytics-chart-legend${compact ? " is-compact" : ""}`}>
      <span><i className="series-billed" />Billed</span>
      <span><i className="series-collected" />Collected</span>
      <span><i className="series-expenses" />Expenses</span>
    </div>
  );
}

export function FinancialTrendChart({
  points,
  compact = false,
  hideLegend = false,
}: {
  points: Array<{ month?: string; label: string; billedVnd: string; collectedVnd: string; expensesVnd: string }>;
  compact?: boolean;
  hideLegend?: boolean;
}) {
  const max = Math.max(
    1,
    ...points.flatMap((point) => [Number(point.billedVnd), Number(point.collectedVnd), Number(point.expensesVnd)]),
  );
  return (
    <div className={`analytics-chart${compact ? " is-compact" : ""}`} role="img" aria-label="Billed, collected, and expenses trend">
      {!hideLegend ? <FinancialTrendLegend /> : null}
      <div className={`analytics-bar-grid${compact ? " is-compact" : ""}`} style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point) => (
          <div
            className="analytics-bar-month"
            key={point.month ?? point.label}
            title={`${formatLongMonth(point.month, point.label)}\nBilled: ${formatVnd(point.billedVnd)}\nCollected: ${formatVnd(point.collectedVnd)}\nExpenses: ${formatVnd(point.expensesVnd)}`}
          >
            <div className="analytics-bar-group">
              <Bar value={Number(point.billedVnd)} max={max} className="series-billed" />
              <Bar value={Number(point.collectedVnd)} max={max} className="series-collected" />
              <Bar value={Number(point.expensesVnd)} max={max} className="series-expenses" />
            </div>
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const height = value <= 0 ? 2 : Math.max(4, (value / max) * 100);
  return <i className={`analytics-bar ${className}`} style={{ height: `${height}%` }} />;
}

export function OccupancyTrendChart({ points }: { points: Array<{ label: string; occupancyRate: number }> }) {
  return (
    <div className="occupancy-trend-chart" role="img" aria-label="Monthly occupancy rate">
      {points.map((point) => (
        <div key={point.label} className="occupancy-trend-column" title={`${point.label}: ${point.occupancyRate.toFixed(1)}%`}>
          <div><i style={{ height: `${Math.max(2, point.occupancyRate)}%` }} /></div>
          <span>{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ExpenseCategoryBars({ points }: { points: Array<{ category: string; amountVnd: string }> }) {
  const max = Math.max(1, ...points.map((point) => Number(point.amountVnd)));
  return (
    <div className="expense-category-bars">
      {points.length ? points.map((point) => (
        <div className="expense-category-row" key={point.category}>
          <span>{labelEnum(point.category)}</span>
          <div><i style={{ width: `${Math.max(2, (Number(point.amountVnd) / max) * 100)}%` }} /></div>
          <strong>{formatVnd(point.amountVnd)}</strong>
        </div>
      )) : <p className="analytics-inline-empty">No expenses recorded.</p>}
    </div>
  );
}

function labelEnum(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}


function formatLongMonth(month: string | undefined, fallback: string) {
  if (!month) return fallback;
  const value = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return fallback;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(value);
}
