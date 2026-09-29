"use client";

import * as React from "react";
import { Cpu, Radio, Search, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/presentation";

import type { DevicePageView } from "../domain/types";
import { DeviceDetailDialog, DeviceFormDialog } from "./asset-dialogs";
import { DeviceStatusBadge } from "./assets-ui";

export function DevicesDashboard({ propertyId, view }: { propertyId: string; view: DevicePageView }) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const items = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return view.items.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (normalized && !`${item.name} ${item.deviceType} ${item.assetName ?? ""} ${item.meterLabel ?? ""} ${item.locationLabel}`.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [search, status, view.items]);

  return (
    <>
      <header className="assets-header">
        <div className="assets-header-copy">
          <p className="assets-eyebrow">ASSET DEVICES</p>
          <h1>Devices</h1>
          <p>Register property devices and link them to rooms, meters, or assets.</p>
        </div>
        <DeviceFormDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} />
      </header>

      <section className="device-summary-strip" aria-label="Device registry summary">
        <MiniStat icon={<Cpu />} label="Registered" value={view.summary.total} />
        <MiniStat icon={<Wifi />} label="Online" value={view.summary.online} tone="success" />
        <MiniStat icon={<WifiOff />} label="Offline" value={view.summary.offline} tone="danger" />
        <MiniStat icon={<Radio />} label="Unknown" value={view.summary.unknown} />
      </section>

      <section className="assets-panel assets-list-panel">
        <div className="assets-panel-header"><div><h2>Device registry</h2><p>Foundation metadata only — no telemetry, controls, or realtime connection.</p></div><span className="assets-count-pill">{items.length} shown</span></div>
        <div className="assets-filters device-filters">
          <label className="assets-search"><Search /><span className="sr-only">Search devices</span><Input type="search" placeholder="Search device, link, location" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Device status filter"><option value="ALL">All statuses</option><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option><option value="UNKNOWN">Unknown</option></select>
        </div>
        {items.length ? (
          <>
            <div className="assets-desktop-table"><table className="assets-table device-table"><thead><tr><th>Device</th><th>Type</th><th>Linked to</th><th>Location</th><th>Status</th><th>Last seen</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><div className="asset-primary-cell"><strong>{item.name}</strong>{item.externalId && <span>ID {item.externalId}</span>}{item.protocol && <small>{item.protocol}</small>}</div></td>
                  <td>{item.deviceType}</td>
                  <td>{item.assetName ? `Asset · ${item.assetName}` : item.meterLabel ? item.meterLabel : item.spaceName ? `Space · ${item.spaceName}` : <span className="asset-muted">Unlinked</span>}</td>
                  <td>{item.locationLabel}</td>
                  <td><DeviceStatusBadge status={item.status} /></td>
                  <td>{item.lastSeenAt ? formatDate(item.lastSeenAt.slice(0, 10)) : <span className="asset-muted">—</span>}</td>
                  <td><DeviceDetailDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} device={item} trigger={<Button variant="outline" size="sm">View</Button>} /></td>
                </tr>
              ))}
            </tbody></table></div>
            <div className="assets-mobile-list">{items.map((item) => <article key={item.id} className="asset-mobile-card"><div className="asset-mobile-card-head"><div><strong>{item.name}</strong><span>{item.deviceType}</span></div><DeviceStatusBadge status={item.status} /></div><p>{item.assetName || item.meterLabel || item.locationLabel}</p><span className="asset-cell-subtle">Last seen {item.lastSeenAt ? formatDate(item.lastSeenAt.slice(0, 10)) : "—"}</span><DeviceDetailDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} device={item} trigger={<Button variant="outline" size="sm">View</Button>} /></article>)}</div>
          </>
        ) : <div className="asset-empty-state"><Radio /><strong>No devices registered.</strong><p>Add a device when you want to link sensors, controllers, or meters to the property.</p><DeviceFormDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} /></div>}
      </section>
    </>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "success" | "danger" }) {
  return <div className={`device-mini-stat${tone ? ` is-${tone}` : ""}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
