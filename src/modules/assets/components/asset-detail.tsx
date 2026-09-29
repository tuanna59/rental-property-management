"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  History,
  ImageIcon,
  MapPin,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatVndLocale } from "@/i18n/format";
import { ExpenseFormDialog, MaintenanceFormDialog } from "@/modules/operations/components/operation-dialogs";

import type { AssetCategoryView, AssetDetailView, AssetLocationOption, AssetOptionView, AssetStatus } from "../domain/types";
import {
  AssetAttachmentActions,
  AssetDocumentDialog,
  AssetFormDialog,
  AssetLifecycleButton,
  ReplaceAssetDialog,
} from "./asset-dialogs";
import { AssetStatusBadge, UnderMaintenanceBadge, WarrantyBadge } from "./assets-ui";

type Tab = "OVERVIEW" | "MAINTENANCE" | "EXPENSES" | "DOCUMENTS" | "HISTORY";

export function AssetDetailWorkspace({
  asset,
  categories,
  locations,
  assetOptions,
}: {
  asset: AssetDetailView;
  categories: AssetCategoryView[];
  locations: AssetLocationOption[];
  assetOptions: AssetOptionView[];
}) {
  const t = useTranslations("assets");
  const locale = useLocale() as AppLocale;
  const [tab, setTab] = React.useState<Tab>("OVERVIEW");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const coverPhoto = asset.attachments.find((item) => item.type === "PHOTO");
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "OVERVIEW", label: t("overview") },
    { id: "MAINTENANCE", label: t("maintenance") },
    { id: "EXPENSES", label: t("expenses") },
    { id: "DOCUMENTS", label: t("documents") },
    { id: "HISTORY", label: t("history") },
  ];

  return (
    <>
      <div className="asset-detail-back"><Link href="/assets">← {t("backToAssets")}</Link></div>
      <header className="asset-detail-header">
        <div className={`asset-detail-icon${coverPhoto ? " has-cover" : ""}`}>
          {coverPhoto ? <img src={coverPhoto.url} alt={t("assetImageAlt", { name: asset.name })} /> : <ImageIcon />}
        </div>
        <div className="asset-detail-identity">
          <div className="asset-detail-title-row"><h1>{asset.name}</h1><AssetStatusBadge status={asset.status} />{asset.underMaintenance && <UnderMaintenanceBadge />}</div>
          <strong>{asset.categoryName === "Uncategorized" ? t("uncategorized") : asset.categoryName}</strong>
          <span><MapPin /> {asset.locationLabel === "Property" ? t("propertyLevel") : asset.locationLabel}</span>
          <small>{[asset.brand, asset.model, asset.serialNumber ? t("serialAbbr", { serial: asset.serialNumber }) : null].filter(Boolean).join(" · ") || t("noManufacturerMetadata")}</small>
        </div>
        <div className="asset-detail-actions">
          <AssetFormDialog propertyId={asset.propertyId} categories={categories} locations={locations} asset={asset} trigger={<Button variant="outline"><Pencil /> {t("edit")}</Button>} />
          <div className="asset-action-menu-wrap">
            <Button variant="outline" size="icon" aria-label={t("moreAssetActions")} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal /></Button>
            {menuOpen && (
              <div className="asset-action-menu">
                {asset.status === "ACTIVE" && (
                  <button type="button" onClick={() => { setMenuOpen(false); setReplaceOpen(true); }}>
                    <RefreshCw /> {t("replaceAsset")}
                  </button>
                )}
                {asset.status === "ACTIVE" && (
                  <AssetLifecycleButton assetId={asset.id} status="RETIRED" variant="ghost" onSuccess={() => setMenuOpen(false)}>
                    <Archive /> {t("retireAsset")}
                  </AssetLifecycleButton>
                )}
                {asset.status !== "DISPOSED" && (
                  <AssetLifecycleButton assetId={asset.id} status="DISPOSED" variant="ghost" onSuccess={() => setMenuOpen(false)}>
                    <Trash2 /> {t("disposeAsset")}
                  </AssetLifecycleButton>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {asset.status === "ACTIVE" && (
        <ReplaceAssetDialog asset={asset} categories={categories} locations={locations} open={replaceOpen} onOpenChange={setReplaceOpen} />
      )}

      <section className="asset-detail-summary-grid">
        <DetailStat icon={<CircleDollarSign />} label={t("purchase")} value={asset.purchasePriceVnd ? formatVndLocale(asset.purchasePriceVnd, locale) : t("notRecorded")} insight={asset.purchaseDate ? formatDateOnlyLocale(asset.purchaseDate, locale) : t("noPurchaseDate")} />
        <DetailStat icon={<ShieldCheck />} label={t("warranty")} value={asset.warrantyExpiresAt ? formatDateOnlyLocale(asset.warrantyExpiresAt, locale) : t("noWarranty")} insight={<WarrantyBadge state={asset.warrantyState} />} />
        <DetailStat icon={<Wrench />} label={t("maintenance")} value={t("maintenanceActiveCount", { count: asset.maintenanceSummary.open + asset.maintenanceSummary.inProgress })} insight={t("completedCount", { count: asset.maintenanceSummary.completed })} />
        <DetailStat icon={<ReceiptText />} label={t("lifetimeCost")} value={formatVndLocale(asset.lifetimeCostVnd, locale)} insight={t("linkedExpensesValue", { amount: formatVndLocale(asset.linkedExpenseTotalVnd, locale) })} />
      </section>

      <section className="asset-detail-panel">
        <nav className="asset-detail-tabs" aria-label={t("detailSections")}>
          {tabs.map((item) => <button key={item.id} className={tab === item.id ? "is-active" : ""} type="button" onClick={() => setTab(item.id)}>{item.label}</button>)}
        </nav>
        <div className="asset-tab-content">
          {tab === "OVERVIEW" && <OverviewTab asset={asset} />}
          {tab === "MAINTENANCE" && <MaintenanceTab asset={asset} locations={locations} assetOptions={assetOptions} />}
          {tab === "EXPENSES" && <ExpensesTab asset={asset} locations={locations} assetOptions={assetOptions} />}
          {tab === "DOCUMENTS" && <DocumentsTab asset={asset} />}
          {tab === "HISTORY" && <HistoryTab asset={asset} />}
        </div>
      </section>
    </>
  );
}

function DetailStat({ icon, label, value, insight }: { icon: React.ReactNode; label: string; value: React.ReactNode; insight: React.ReactNode }) {
  return <article className="asset-detail-stat"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{insight}</em></div></article>;
}

function OverviewTab({ asset }: { asset: AssetDetailView }) {
  const t = useTranslations("assets");
  const locale = useLocale() as AppLocale;
  const metadata = [
    [t("category"), asset.categoryName === "Uncategorized" ? t("uncategorized") : asset.categoryName],
    [t("location"), asset.locationLabel === "Property" ? t("propertyLevel") : asset.locationLabel],
    [t("brand"), asset.brand || t("notProvided")],
    [t("model"), asset.model || t("notProvided")],
    [t("serialNumber"), asset.serialNumber || t("notProvided")],
    [t("purchaseDate"), asset.purchaseDate ? formatDateOnlyLocale(asset.purchaseDate, locale) : t("notProvided")],
    [t("purchasePrice"), asset.purchasePriceVnd ? formatVndLocale(asset.purchasePriceVnd, locale) : t("notProvided")],
    [t("warrantyExpires"), asset.warrantyExpiresAt ? formatDateOnlyLocale(asset.warrantyExpiresAt, locale) : t("notProvided")],
  ];
  return (
    <div className="asset-overview-flow">
      <section className="asset-metadata-grid">{metadata.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
      <section className="asset-notes-block"><div><FileText /><strong>{t("notes")}</strong></div><p>{asset.notes || t("noNotes")}</p></section>
      {(asset.replacementForAsset || asset.replacedByAsset) && (
        <section className="asset-replacement-chain"><History /><div><strong>{t("replacementHistory")}</strong>{asset.replacementForAsset && <p>{t("replaced")} <Link href={`/assets/${asset.replacementForAsset.id}`}>{asset.replacementForAsset.name}</Link></p>}{asset.replacedByAsset && <p>{t("replacedBy")} <Link href={`/assets/${asset.replacedByAsset.id}`}>{asset.replacedByAsset.name}</Link></p>}</div></section>
      )}
    </div>
  );
}

function MaintenanceTab({ asset, locations, assetOptions }: { asset: AssetDetailView; locations: AssetLocationOption[]; assetOptions: AssetOptionView[] }) {
  const t = useTranslations("assets");
  const op = useTranslations("operations");
  const locale = useLocale() as AppLocale;
  return (
    <div className="asset-tab-stack">
      <div className="asset-tab-toolbar"><div><h2>{t("maintenanceHistory")}</h2><p>{t("maintenanceHistorySubtitle")}</p></div>{asset.status === "ACTIVE" && <MaintenanceFormDialog propertyId={asset.propertyId} locations={locations} assetOptions={assetOptions} defaultAssetId={asset.id} defaultFloorId={asset.floorId} defaultSpaceId={asset.spaceId} trigger={<Button><Wrench /> {t("createMaintenanceIssue")}</Button>} />}</div>
      {asset.maintenance.length ? (
        <div className="asset-timeline">
          {asset.maintenance.map((item) => (
            <article key={item.id}>
              <span className={`asset-timeline-dot is-${item.status.toLowerCase()}`} />
              <div>
                <div className="asset-history-head"><strong>{item.title}</strong><span>{formatDateOnlyLocale(item.reportedAt, locale)}</span></div>
                <p>{item.description}</p>
                <small>{maintenancePriorityLabel(item.priority, op)} · {maintenanceStatusLabel(item.status, op)}{item.costVnd !== "0" ? ` · ${formatVndLocale(item.costVnd, locale)}` : ""}</small>
                <Button asChild variant="ghost" size="sm"><Link href={`/operations/maintenance?issue=${item.id}`}>{t("openMaintenance")}</Link></Button>
              </div>
            </article>
          ))}
        </div>
      ) : <AssetEmpty title={t("noMaintenanceHistory")} detail={t("noMaintenanceHistoryDetail")} />}
    </div>
  );
}

function ExpensesTab({ asset, locations, assetOptions }: { asset: AssetDetailView; locations: AssetLocationOption[]; assetOptions: AssetOptionView[] }) {
  const t = useTranslations("assets");
  const op = useTranslations("operations");
  const locale = useLocale() as AppLocale;
  return (
    <div className="asset-tab-stack">
      <div className="asset-tab-toolbar"><div><h2>{t("linkedExpenses")}</h2><p>{t("linkedExpensesSubtitle")}</p></div><ExpenseFormDialog propertyId={asset.propertyId} locations={locations} maintenanceOptions={[]} assetOptions={assetOptions} defaultAssetId={asset.id} defaultFloorId={asset.floorId} defaultSpaceId={asset.spaceId} trigger={<Button variant="outline"><ReceiptText /> {t("addExpense")}</Button>} /></div>
      <div className="asset-cost-breakdown"><span>{t("purchaseLabel")} <strong>{formatVndLocale(asset.purchasePriceVnd ?? 0, locale)}</strong></span><span>{t("linkedExpenses")} <strong>{formatVndLocale(asset.linkedExpenseTotalVnd, locale)}</strong></span><span>{t("lifetime")} <strong>{formatVndLocale(asset.lifetimeCostVnd, locale)}</strong></span></div>
      {asset.expenses.length ? (
        <div className="asset-simple-list">
          {asset.expenses.map((expense) => <article key={expense.id}><div><strong>{expense.description}</strong><span>{formatDateOnlyLocale(expense.expenseDate, locale)} · {expenseCategoryLabel(expense.category, op)}</span>{expense.maintenanceTitle && <small>{op("maintenance")} · {expense.maintenanceTitle}</small>}</div><strong>{formatVndLocale(expense.amountVnd, locale)}</strong></article>)}
        </div>
      ) : <AssetEmpty title={t("noLinkedExpenses")} detail={t("noLinkedExpensesDetail")} />}
    </div>
  );
}

function DocumentsTab({ asset }: { asset: AssetDetailView }) {
  const t = useTranslations("assets");
  const locale = useLocale() as AppLocale;
  const photos = asset.attachments.filter((item) => item.type === "PHOTO");
  const documents = asset.attachments.filter((item) => item.type !== "PHOTO");
  return (
    <div className="asset-tab-stack">
      <div className="asset-tab-toolbar"><div><h2>{t("documentsPhotos")}</h2><p>{t("documentsPhotosSubtitle")}</p></div><AssetDocumentDialog propertyId={asset.propertyId} assetId={asset.id} /></div>
      <PhotoGallery photos={photos} />
      {documents.length ? <div className="asset-document-list">{documents.map((item) => <article key={item.id}><div><FileText /><span><strong>{item.title || documentTypeLabel(item.type, t)}</strong><small>{documentTypeLabel(item.type, t)} · {formatDateOnlyLocale(item.createdAt.slice(0, 10), locale)}</small></span></div><AssetAttachmentActions propertyId={asset.propertyId} assetId={asset.id} attachment={item} /></article>)}</div> : <AssetEmpty title={t("noAssetDocuments")} detail={t("noAssetDocumentsDetail")} />}
    </div>
  );
}

function PhotoGallery({ photos }: { photos: AssetDetailView["attachments"] }) {
  const t = useTranslations("assets");
  const [index, setIndex] = React.useState(0);
  if (!photos.length) return <div className="asset-photo-empty"><ImageIcon /><span>{t("noAssetPhotos")}</span></div>;
  const current = photos[Math.min(index, photos.length - 1)]!;
  return (
    <section className="asset-photo-section">
      <div className="asset-section-heading"><strong>{t("photos")}</strong><span>{t("attachedCount", { count: photos.length })}</span></div>
      <div className="asset-photo-thumbnails">{photos.map((photo, photoIndex) => <button key={photo.id} type="button" className={index === photoIndex ? "is-active" : ""} onClick={() => setIndex(photoIndex)}><img src={photo.url} alt="" /></button>)}</div>
      <Dialog>
        <DialogTrigger asChild><button type="button" className="asset-photo-viewer-trigger"><img src={current.url} alt={t("selectedAssetAlt")} /></button></DialogTrigger>
        <DialogContent className="asset-photo-dialog">
          <DialogHeader><DialogTitle>{t("assetPhotosTitle", { current: index + 1, total: photos.length })}</DialogTitle></DialogHeader>
          <div className="asset-photo-viewer"><img src={current.url} alt={t("assetAttachmentAlt")} />{photos.length > 1 && <><button type="button" className="is-prev" onClick={() => setIndex((value) => (value - 1 + photos.length) % photos.length)} aria-label={t("previousPhoto")}><ChevronLeft /></button><button type="button" className="is-next" onClick={() => setIndex((value) => (value + 1) % photos.length)} aria-label={t("nextPhoto")}><ChevronRight /></button></>}</div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function HistoryTab({ asset }: { asset: AssetDetailView }) {
  const t = useTranslations("assets");
  const locale = useLocale() as AppLocale;
  const op = useTranslations("operations");
  return (
    <div className="asset-tab-stack">
      {(asset.replacementForAsset || asset.replacedByAsset) && (
        <section className="asset-replacement-chain"><History /><div><strong>{t("replacementRelationship")}</strong>{asset.replacementForAsset && <p>{t("replaces")} <Link href={`/assets/${asset.replacementForAsset.id}`}>{asset.replacementForAsset.name}</Link> · {assetStatusText(asset.replacementForAsset.status, t)}</p>}{asset.replacedByAsset && <p>{t("replacedBy")} <Link href={`/assets/${asset.replacedByAsset.id}`}>{asset.replacedByAsset.name}</Link> · {assetStatusText(asset.replacedByAsset.status, t)}</p>}</div></section>
      )}
      {asset.history.length ? <div className="asset-timeline">{asset.history.map((item) => <article key={item.id}><span className={`asset-timeline-dot is-${item.tone}`} /><div><div className="asset-history-head"><strong>{historyTitleLabel(item.title, t, op)}</strong><span>{formatDateOnlyLocale(item.date, locale)}</span></div>{item.detail && <p>{item.detail.match(/^\d+$/) ? formatVndLocale(item.detail, locale) : historyDetailLabel(item.detail, op)}</p>}</div></article>)}</div> : <AssetEmpty title={t("noHistoryYet")} detail={t("noHistoryDetail")} />}
    </div>
  );
}

function AssetEmpty({ title, detail }: { title: string; detail: string }) {
  return <div className="asset-empty-state is-compact"><History /><strong>{title}</strong><p>{detail}</p></div>;
}

function assetStatusText(status: AssetStatus, t: any) {
  return status === "ACTIVE" ? t("active") : status === "RETIRED" ? t("retired") : t("disposed");
}

function maintenancePriorityLabel(priority: AssetDetailView["maintenance"][number]["priority"], opT: any) {
  return priority === "URGENT" ? opT("urgent") : priority === "HIGH" ? opT("high") : priority === "MEDIUM" ? opT("medium") : opT("low");
}

function maintenanceStatusLabel(status: AssetDetailView["maintenance"][number]["status"], opT: any) {
  return status === "OPEN" ? opT("open") : status === "IN_PROGRESS" ? opT("inProgress") : opT("completed");
}

function expenseCategoryLabel(category: string, opT: any) {
  return category === "REPAIR" ? opT("repair") : category === "UTILITIES" ? opT("utilitiesCategory") : category === "CLEANING" ? opT("cleaning") : category === "SUPPLIES" ? opT("supplies") : category === "OTHER" ? opT("other") : category;
}

function historyTitleLabel(title: string, t: any, op: any) {
  if (title === "Purchased") return t("purchased");
  if (title === "Recorded in inventory") return t("recordedInInventory");
  if (title === "Retired") return t("retired");
  if (title === "Disposed") return t("disposed");
  if (title.startsWith("Maintenance · ")) return `${op("maintenance")} · ${title.slice("Maintenance · ".length)}`;
  return title;
}

function historyDetailLabel(detail: string, op: any) {
  return detail === "Completed" ? op("completed") : detail === "In progress" ? op("inProgress") : detail === "Open" ? op("open") : detail;
}

function documentTypeLabel(type: string, t: any) {
  return type === "RECEIPT" ? t("purchaseReceipt") : type === "WARRANTY" ? t("warranty") : type === "MANUAL" ? t("manual") : type === "SERIAL" ? t("serialLabel") : type === "OTHER" ? t("other") : type === "PHOTO" ? t("photo") : type;
}
