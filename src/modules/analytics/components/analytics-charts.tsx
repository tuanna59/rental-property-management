import { formatVnd } from "@/lib/presentation";

export function FinancialTrendChart({
  points,
}: {
  points: Array<{ label: string; billedVnd: string; collectedVnd: string; expensesVnd: string }>;
}) {
  const max = Math.max(
    1,
    ...points.flatMap((point) => [Number(point.billedVnd), Number(point.collectedVnd), Number(point.expensesVnd)]),
  );
  return (
    <div className="analytics-chart" role="img" aria-label="Billed, collected, and expenses trend">
      <div className="analytics-chart-legend">
        <span><i className="series-billed" />Billed</span>
        <span><i className="series-collected" />Collected</span>
        <span><i className="series-expenses" />Expenses</span>
      </div>
      <div className="analytics-bar-grid" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point) => (
          <div className="analytics-bar-month" key={point.label}>
            <div className="analytics-bar-group">
              <Bar value={Number(point.billedVnd)} max={max} className="series-billed" label={`Billed ${formatVnd(point.billedVnd)}`} />
              <Bar value={Number(point.collectedVnd)} max={max} className="series-collected" label={`Collected ${formatVnd(point.collectedVnd)}`} />
              <Bar value={Number(point.expensesVnd)} max={max} className="series-expenses" label={`Expenses ${formatVnd(point.expensesVnd)}`} />
            </div>
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label: string }) {
  const height = value <= 0 ? 2 : Math.max(4, (value / max) * 100);
  return <i className={`analytics-bar ${className}`} style={{ height: `${height}%` }} title={label} />;
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
