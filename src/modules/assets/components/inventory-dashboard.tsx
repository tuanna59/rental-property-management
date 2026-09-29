"use client";

import * as React from "react";
import Link from "next/link";
import {
  Boxes,
  CircleDollarSign,
  PackageOpen,
  Search,
  Settings2,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatVnd } from "@/lib/presentation";

import type { AssetInventoryPageView } from "../domain/types";
import { AssetFormDialog, CategoryManager } from "./asset-dialogs";
import { AssetStatusBadge, UnderMaintenanceBadge, WarrantyBadge } from "./assets-ui";

export function InventoryDashboard({
  propertyId,
  view,
  initialLocation,
}: {
  propertyId: string;
  view: AssetInventoryPageView;
  initialLocation?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("ALL");
  const validInitialLocation = initialLocation && (
    view.locations.some((item) => item.spaceId === initialLocation || item.floorId === initialLocation)
  ) ? initialLocation : "ALL";
  const [location, setLocation] = React.useState(validInitialLocation);
  const [status, setStatus] = React.useState("ACTIVE");

  const items = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return view.items.filter((item) => {
      if (category !== "ALL" && item.categoryId !== category) return false;
      if (location === "PROPERTY" && (item.floorId || item.spaceId)) return false;
      if (location !== "ALL" && location !== "PROPERTY" && item.spaceId !== location && item.floorId !== location) return false;
      if (status === "MAINTENANCE" && !item.underMaintenance) return false;
      if (status !== "ALL" && status !== "MAINTENANCE" && item.status !== status) return false;
      if (
        normalized &&
        !`${item.name} ${item.categoryName} ${item.brand ?? ""} ${item.model ?? ""} ${item.serialNumber ?? ""} ${item.locationLabel}`
          .toLowerCase()
          .includes(normalized)
      ) return false;
      return true;
    });
  }, [category, location, search, status, view.items]);

  const activeCategories = view.categories.filter((item) => !item.archived);
  const floorOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    view.locations.forEach((item) => map.set(item.floorId, item.floorName));
    return [...map].map(([id, name]) => ({ id, name }));
  }, [view.locations]);

  return (
    <>
      <header className="assets-header">
        <div className="assets-header-copy">
          <p className="assets-eyebrow">PROPERTY ASSETS</p>
          <h1>Assets</h1>
          <p>Track property equipment, warranty, maintenance, documents, and lifetime cost.</p>
        </div>
        <div className="assets-header-actions">
          <CategoryManager
            propertyId={propertyId}
            categories={view.categories}
            trigger={<Button variant="outline"><Settings2 /> Manage categories</Button>}
          />
          <AssetFormDialog
            propertyId={propertyId}
            categories={view.categories}
            locations={view.locations}
          />
        </div>
      </header>

      {!view.schemaReady && (
        <section className="asset-schema-banner">
          <Boxes />
          <div><strong>Assets schema is not installed yet.</strong><span>Apply the Phase 7 migration and regenerate Prisma Client.</span></div>
        </section>
      )}

      <section className="assets-summary-grid" aria-label="Asset inventory summary">
        <SummaryCard icon={<PackageOpen />} label="Active assets" value={view.summary.active} insight="Current physical inventory" />
        <SummaryCard icon={<Wrench />} label="Under maintenance" value={view.summary.underMaintenance} insight="Active assets needing attention" />
        <SummaryCard icon={<ShieldAlert />} label="Warranty expiring" value={view.summary.warrantyExpiring} insight="Within the next 30 days" />
        <SummaryCard icon={<CircleDollarSign />} label="Recorded purchase value" value={formatVnd(view.summary.recordedPurchaseValueVnd)} insight="Informational · excludes disposed" />
      </section>

      <section className="assets-panel assets-list-panel">
        <div className="assets-panel-header">
          <div><h2>Inventory</h2><p>Physical lifecycle and operational state are tracked separately.</p></div>
          <span className="assets-count-pill">{items.length} shown</span>
        </div>
        <div className="assets-filters">
          <label className="assets-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search assets</span>
            <Input type="search" placeholder="Search asset, serial, location" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select aria-label="Category filter" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="ALL">All categories</option>
            {activeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Location filter" value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="ALL">All locations</option>
            <option value="PROPERTY">Property level</option>
            {floorOptions.map((floor) => <option key={`floor-${floor.id}`} value={floor.id}>{floor.name}</option>)}
            {view.locations.map((item) => <option key={item.spaceId} value={item.spaceId}>{item.spaceName} · {item.floorName}</option>)}
          </select>
          <select aria-label="Status filter" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="ALL">All lifecycle states</option>
            <option value="MAINTENANCE">Under maintenance</option>
            <option value="RETIRED">Retired</option>
            <option value="DISPOSED">Disposed</option>
          </select>
        </div>

        {items.length ? (
          <>
            <div className="assets-desktop-table">
              <table className="assets-table">
                <thead><tr><th>Asset</th><th>Category</th><th>Location</th><th>Status</th><th>Warranty</th><th>Maintenance</th><th><span className="sr-only">Action</span></th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="asset-primary-cell">
                          <strong>{item.name}</strong>
                          <span>{[item.brand, item.model].filter(Boolean).join(" · ") || "Physical asset"}</span>
                          {item.serialNumber && <small>SN {item.serialNumber}</small>}
                        </div>
                      </td>
                      <td>{item.categoryName}</td>
                      <td><strong>{item.spaceName || item.floorName || "Property"}</strong>{item.spaceName && item.floorName && <span className="asset-cell-subtle">{item.floorName}</span>}</td>
                      <td><div className="asset-badge-stack"><AssetStatusBadge status={item.status} />{item.underMaintenance && <UnderMaintenanceBadge />}</div></td>
                      <td><div className="asset-warranty-cell"><WarrantyBadge state={item.warrantyState} />{item.warrantyExpiresAt && <span>{formatDate(item.warrantyExpiresAt)}</span>}</div></td>
                      <td>{item.activeMaintenanceCount ? `${item.activeMaintenanceCount} active issue${item.activeMaintenanceCount === 1 ? "" : "s"}` : <span className="asset-muted">Clear</span>}</td>
                      <td><Button asChild variant="outline" size="sm"><Link href={`/assets/${item.id}`}>View</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="assets-mobile-list">
              {items.map((item) => (
                <article key={item.id} className="asset-mobile-card">
                  <div className="asset-mobile-card-head"><div><strong>{item.name}</strong><span>{item.categoryName}</span></div><AssetStatusBadge status={item.status} /></div>
                  <p>{item.locationLabel}</p>
                  <div className="asset-mobile-meta"><WarrantyBadge state={item.warrantyState} />{item.underMaintenance && <UnderMaintenanceBadge />}</div>
                  <Button asChild variant="outline" size="sm"><Link href={`/assets/${item.id}`}>View asset</Link></Button>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="asset-empty-state">
            <PackageOpen />
            <strong>{view.items.length ? "No assets match this view" : "No assets recorded yet"}</strong>
            <p>{view.items.length ? "Adjust search or filters." : "Start tracking property equipment and appliances."}</p>
            {!view.items.length && <AssetFormDialog propertyId={propertyId} categories={view.categories} locations={view.locations} />}
          </div>
        )}
      </section>
    </>
  );
}

function SummaryCard({ icon, label, value, insight }: { icon: React.ReactNode; label: string; value: React.ReactNode; insight: string }) {
  return (
    <article className="asset-summary-card">
      <span className="asset-summary-icon">{icon}</span>
      <div><span>{label}</span><strong>{value}</strong><small>{insight}</small></div>
    </article>
  );
}
