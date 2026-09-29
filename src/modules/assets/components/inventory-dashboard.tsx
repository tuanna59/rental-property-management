"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
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
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatVndLocale } from "@/i18n/format";

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
  const t = useTranslations("assets");
  const locale = useLocale() as AppLocale;
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
          <p className="assets-eyebrow">{t("propertyAssets")}</p>
          <h1>{t("title")}</h1>
          <p>{t("assetsSubtitle")}</p>
        </div>
        <div className="assets-header-actions">
          <CategoryManager
            propertyId={propertyId}
            categories={view.categories}
            trigger={<Button variant="outline"><Settings2 /> {t("manageCategories")}</Button>}
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
          <div><strong>{t("schemaMissingTitle")}</strong><span>{t("schemaMissingDescription")}</span></div>
        </section>
      )}

      <section className="assets-summary-grid" aria-label={t("assetInventorySummary")}>
        <SummaryCard icon={<PackageOpen />} label={t("activeAssets")} value={view.summary.active} insight={t("currentPhysicalInventory")} />
        <SummaryCard icon={<Wrench />} label={t("underMaintenance")} value={view.summary.underMaintenance} insight={t("activeAssetsNeedingAttention")} />
        <SummaryCard icon={<ShieldAlert />} label={t("warrantyExpiring")} value={view.summary.warrantyExpiring} insight={t("withinNext30Days")} />
        <SummaryCard icon={<CircleDollarSign />} label={t("recordedPurchaseValue")} value={formatVndLocale(view.summary.recordedPurchaseValueVnd, locale)} insight={t("excludesDisposed")} />
      </section>

      <section className="assets-panel assets-list-panel">
        <div className="assets-panel-header">
          <div><h2>{t("inventory")}</h2><p>{t("inventorySubtitle")}</p></div>
          <span className="assets-count-pill">{t("shownCount", { count: items.length })}</span>
        </div>
        <div className="assets-filters">
          <label className="assets-search">
            <Search aria-hidden="true" />
            <span className="sr-only">{t("searchAssets")}</span>
            <Input type="search" placeholder={t("searchAssetPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select aria-label={t("categoryFilter")} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="ALL">{t("allCategories")}</option>
            {activeCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label={t("locationFilter")} value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="ALL">{t("allLocations")}</option>
            <option value="PROPERTY">{t("propertyLevel")}</option>
            {floorOptions.map((floor) => <option key={`floor-${floor.id}`} value={floor.id}>{floor.name}</option>)}
            {view.locations.map((item) => <option key={item.spaceId} value={item.spaceId}>{item.spaceName} · {item.floorName}</option>)}
          </select>
          <select aria-label={t("statusFilter")} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ACTIVE">{t("active")}</option>
            <option value="ALL">{t("allLifecycleStates")}</option>
            <option value="MAINTENANCE">{t("underMaintenance")}</option>
            <option value="RETIRED">{t("retired")}</option>
            <option value="DISPOSED">{t("disposed")}</option>
          </select>
        </div>

        {items.length ? (
          <>
            <div className="assets-desktop-table">
              <table className="assets-table">
                <thead><tr><th>{t("asset")}</th><th>{t("category")}</th><th>{t("location")}</th><th>{t("status")}</th><th>{t("warranty")}</th><th>{t("maintenance")}</th><th><span className="sr-only">{t("action")}</span></th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="asset-primary-cell">
                          <strong>{item.name}</strong>
                          <span>{[item.brand, item.model].filter(Boolean).join(" · ") || t("physicalAsset")}</span>
                          {item.serialNumber && <small>{t("serialAbbr", { serial: item.serialNumber })}</small>}
                        </div>
                      </td>
                      <td>{item.categoryName === "Uncategorized" ? t("uncategorized") : item.categoryName}</td>
                      <td><strong>{item.locationLabel === "Property" ? t("propertyLevel") : item.locationLabel}</strong></td>
                      <td><div className="asset-badge-stack"><AssetStatusBadge status={item.status} />{item.underMaintenance && <UnderMaintenanceBadge />}</div></td>
                      <td><div className="asset-warranty-cell"><WarrantyBadge state={item.warrantyState} />{item.warrantyExpiresAt && <span>{formatDateOnlyLocale(item.warrantyExpiresAt, locale)}</span>}</div></td>
                      <td>{item.activeMaintenanceCount ? t("activeIssueCount", { count: item.activeMaintenanceCount }) : <span className="asset-muted">{t("clear")}</span>}</td>
                      <td><Button asChild variant="outline" size="sm"><Link href={`/assets/${item.id}`}>{t("view")}</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="assets-mobile-list">
              {items.map((item) => (
                <article key={item.id} className="asset-mobile-card">
                  <div className="asset-mobile-card-head"><div><strong>{item.name}</strong><span>{item.categoryName === "Uncategorized" ? t("uncategorized") : item.categoryName}</span></div><AssetStatusBadge status={item.status} /></div>
                  <p>{item.locationLabel === "Property" ? t("propertyLevel") : item.locationLabel}</p>
                  <div className="asset-mobile-meta"><WarrantyBadge state={item.warrantyState} />{item.underMaintenance && <UnderMaintenanceBadge />}</div>
                  <Button asChild variant="outline" size="sm"><Link href={`/assets/${item.id}`}>{t("viewAsset")}</Link></Button>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="asset-empty-state">
            <PackageOpen />
            <strong>{view.items.length ? t("noAssetsMatch") : t("noAssetsRecorded")}</strong>
            <p>{view.items.length ? t("adjustSearchFilters") : t("startTrackingAssets")}</p>
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
