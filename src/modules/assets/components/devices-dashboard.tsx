"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Cpu, Radio, Search, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/config";
import { formatDateTimeLocale } from "@/i18n/format";

import type { DevicePageView } from "../domain/types";
import { DeviceDetailDialog, DeviceFormDialog } from "./asset-dialogs";
import { DeviceStatusBadge } from "./assets-ui";

export function DevicesDashboard({ propertyId, view }: { propertyId: string; view: DevicePageView }) {
  const t = useTranslations("assets");
  const locale = useLocale() as AppLocale;
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");

  const linkLabel = React.useCallback((item: DevicePageView["items"][number]) => {
    if (item.assetName) return `${t("asset")} · ${item.assetName}`;
    if (item.meterIdentifier) return t("meterLinked", { identifier: item.meterIdentifier });
    if (item.spaceName) return `${t("space")} · ${item.spaceName}`;
    return t("unlinked");
  }, [t]);

  const items = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return view.items.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      const location = item.locationLabel === "Property" ? t("propertyLevel") : item.locationLabel;
      const searchable = `${item.name} ${item.deviceType} ${linkLabel(item)} ${location} ${item.externalId ?? ""} ${item.protocol ?? ""}`.toLowerCase();
      return !normalized || searchable.includes(normalized);
    });
  }, [linkLabel, search, status, t, view.items]);

  return (
    <>
      <header className="assets-header">
        <div className="assets-header-copy">
          <p className="assets-eyebrow">{t("devicesEyebrow")}</p>
          <h1>{t("devices")}</h1>
          <p>{t("devicesSubtitle")}</p>
        </div>
        <DeviceFormDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} />
      </header>

      <section className="device-summary-strip" aria-label={t("deviceRegistrySummary")}>
        <MiniStat icon={<Cpu />} label={t("registered")} value={view.summary.total} />
        <MiniStat icon={<Wifi />} label={t("online")} value={view.summary.online} tone="success" />
        <MiniStat icon={<WifiOff />} label={t("offline")} value={view.summary.offline} tone="danger" />
        <MiniStat icon={<Radio />} label={t("unknown")} value={view.summary.unknown} />
      </section>

      <section className="assets-panel assets-list-panel">
        <div className="assets-panel-header">
          <div>
            <h2>{t("deviceRegistry")}</h2>
            <p>{t("deviceRegistrySubtitle")}</p>
          </div>
          <span className="assets-count-pill">{t("shownCount", { count: items.length })}</span>
        </div>
        <div className="assets-filters device-filters">
          <label className="assets-search">
            <Search />
            <span className="sr-only">{t("searchDevices")}</span>
            <Input type="search" placeholder={t("searchDevicesPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t("deviceStatusFilter")}>
            <option value="ALL">{t("allStatuses")}</option>
            <option value="ONLINE">{t("online")}</option>
            <option value="OFFLINE">{t("offline")}</option>
            <option value="UNKNOWN">{t("unknown")}</option>
          </select>
        </div>
        {items.length ? (
          <>
            <div className="assets-desktop-table">
              <table className="assets-table device-table">
                <thead>
                  <tr>
                    <th>{t("device")}</th>
                    <th>{t("type")}</th>
                    <th>{t("linkedTo")}</th>
                    <th>{t("location")}</th>
                    <th>{t("status")}</th>
                    <th>{t("lastSeen")}</th>
                    <th><span className="sr-only">{t("action")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><div className="asset-primary-cell"><strong>{item.name}</strong>{item.externalId && <span>ID {item.externalId}</span>}{item.protocol && <small>{item.protocol}</small>}</div></td>
                      <td>{item.deviceType}</td>
                      <td>{linkLabel(item)}</td>
                      <td>{item.locationLabel === "Property" ? t("propertyLevel") : item.locationLabel}</td>
                      <td><DeviceStatusBadge status={item.status} /></td>
                      <td>{item.lastSeenAt ? formatDateTimeLocale(item.lastSeenAt, locale) : <span className="asset-muted">—</span>}</td>
                      <td><DeviceDetailDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} device={item} trigger={<Button variant="outline" size="sm">{t("view")}</Button>} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="assets-mobile-list">
              {items.map((item) => (
                <article key={item.id} className="asset-mobile-card">
                  <div className="asset-mobile-card-head"><div><strong>{item.name}</strong><span>{item.deviceType}</span></div><DeviceStatusBadge status={item.status} /></div>
                  <div className="device-mobile-context">
                    <span><small>{t("linkedTo")}</small><strong>{linkLabel(item)}</strong></span>
                    <span><small>{t("location")}</small><strong>{item.locationLabel === "Property" ? t("propertyLevel") : item.locationLabel}</strong></span>
                  </div>
                  <span className="asset-cell-subtle">{item.lastSeenAt ? t("lastSeenValue", { date: formatDateTimeLocale(item.lastSeenAt, locale) }) : `${t("lastSeen")} —`}</span>
                  <DeviceDetailDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} device={item} trigger={<Button variant="outline" size="sm">{t("view")}</Button>} />
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="asset-empty-state">
            <Radio />
            <strong>{t("noDevicesRegistered")}</strong>
            <p>{t("noDevicesRegisteredDetail")}</p>
            <DeviceFormDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} meterOptions={view.meterOptions} />
          </div>
        )}
      </section>
    </>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "success" | "danger" }) {
  return <div className={`device-mini-stat${tone ? ` is-${tone}` : ""}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
