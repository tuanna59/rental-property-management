import "@/modules/analytics/components/analytics.css";

export default function DashboardLoading() {
  return (
    <main className="analytics-page analytics-loading-page" aria-label="Loading dashboard">
      <div className="analytics-loading-header"><i /><i /></div>
      <div className="analytics-loading-hero"><i /><i /></div>
      <div className="analytics-loading-grid">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      <div className="analytics-loading-hero lower"><i /><i /></div>
    </main>
  );
}
