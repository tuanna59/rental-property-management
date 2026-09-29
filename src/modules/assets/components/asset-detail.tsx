"use client";

import * as React from "react";
import Link from "next/link";
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
import { formatDate, formatVnd } from "@/lib/presentation";
import { ExpenseFormDialog, MaintenanceFormDialog } from "@/modules/operations/components/operation-dialogs";

import type { AssetCategoryView, AssetDetailView, AssetLocationOption, AssetOptionView } from "../domain/types";
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
  const [tab, setTab] = React.useState<Tab>("OVERVIEW");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const coverPhoto = asset.attachments.find((item) => item.type === "PHOTO");

  return (
    <>
      <div className="asset-detail-back"><Link href="/assets">← Back to assets</Link></div>
      <header className="asset-detail-header">
        <div className={`asset-detail-icon${coverPhoto ? " has-cover" : ""}`}>{coverPhoto ? <img src={coverPhoto.url} alt={`${asset.name} asset`} /> : <ImageIcon />}</div>
        <div className="asset-detail-identity">
          <div className="asset-detail-title-row"><h1>{asset.name}</h1><AssetStatusBadge status={asset.status} />{asset.underMaintenance && <UnderMaintenanceBadge />}</div>
          <strong>{asset.categoryName}</strong>
          <span><MapPin /> {asset.locationLabel}</span>
          <small>{[asset.brand, asset.model, asset.serialNumber ? `SN ${asset.serialNumber}` : null].filter(Boolean).join(" · ") || "No manufacturer metadata"}</small>
        </div>
        <div className="asset-detail-actions">
          <AssetFormDialog propertyId={asset.propertyId} categories={categories} locations={locations} asset={asset} trigger={<Button variant="outline"><Pencil /> Edit</Button>} />
          <div className="asset-action-menu-wrap">
            <Button variant="outline" size="icon" aria-label="More asset actions" onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal /></Button>
            {menuOpen && (
              <div className="asset-action-menu">
                {asset.status === "ACTIVE" && (
                  <button type="button" onClick={() => { setMenuOpen(false); setReplaceOpen(true); }}>
                    <RefreshCw /> Replace asset
                  </button>
                )}
                {asset.status === "ACTIVE" && (
                  <AssetLifecycleButton assetId={asset.id} status="RETIRED" variant="ghost" onSuccess={() => setMenuOpen(false)}>
                    <Archive /> Retire asset
                  </AssetLifecycleButton>
                )}
                {asset.status !== "DISPOSED" && (
                  <AssetLifecycleButton assetId={asset.id} status="DISPOSED" variant="ghost" onSuccess={() => setMenuOpen(false)}>
                    <Trash2 /> Dispose asset
                  </AssetLifecycleButton>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {asset.status === "ACTIVE" && (
        <ReplaceAssetDialog
          asset={asset}
          categories={categories}
          locations={locations}
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
        />
      )}

      <section className="asset-detail-summary-grid">
        <DetailStat icon={<CircleDollarSign />} label="Purchase" value={asset.purchasePriceVnd ? formatVnd(asset.purchasePriceVnd) : "Not recorded"} insight={asset.purchaseDate ? formatDate(asset.purchaseDate) : "No purchase date"} />
        <DetailStat icon={<ShieldCheck />} label="Warranty" value={asset.warrantyExpiresAt ? formatDate(asset.warrantyExpiresAt) : "No warranty"} insight={<WarrantyBadge state={asset.warrantyState} />} />
        <DetailStat icon={<Wrench />} label="Maintenance" value={`${asset.maintenanceSummary.open + asset.maintenanceSummary.inProgress} active`} insight={`${asset.maintenanceSummary.completed} completed`} />
        <DetailStat icon={<ReceiptText />} label="Lifetime cost" value={formatVnd(asset.lifetimeCostVnd)} insight={`${formatVnd(asset.linkedExpenseTotalVnd)} linked expenses`} />
      </section>

      <section className="asset-detail-panel">
        <nav className="asset-detail-tabs" aria-label="Asset detail sections">
          {(["OVERVIEW", "MAINTENANCE", "EXPENSES", "DOCUMENTS", "HISTORY"] as Tab[]).map((item) => (
            <button key={item} className={tab === item ? "is-active" : ""} type="button" onClick={() => setTab(item)}>{item.charAt(0) + item.slice(1).toLowerCase()}</button>
          ))}
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
  const metadata = [
    ["Category", asset.categoryName], ["Location", asset.locationLabel], ["Brand", asset.brand || "Not provided"], ["Model", asset.model || "Not provided"], ["Serial number", asset.serialNumber || "Not provided"], ["Purchase date", asset.purchaseDate ? formatDate(asset.purchaseDate) : "Not provided"], ["Purchase price", asset.purchasePriceVnd ? formatVnd(asset.purchasePriceVnd) : "Not provided"], ["Warranty expires", asset.warrantyExpiresAt ? formatDate(asset.warrantyExpiresAt) : "Not provided"],
  ];
  return (
    <div className="asset-overview-flow">
      <section className="asset-metadata-grid">{metadata.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
      <section className="asset-notes-block"><div><FileText /><strong>Notes</strong></div><p>{asset.notes || "No notes recorded."}</p></section>
      {(asset.replacementForAsset || asset.replacedByAsset) && (
        <section className="asset-replacement-chain"><History /><div><strong>Replacement history</strong>{asset.replacementForAsset && <p>Replaced <Link href={`/assets/${asset.replacementForAsset.id}`}>{asset.replacementForAsset.name}</Link></p>}{asset.replacedByAsset && <p>Replaced by <Link href={`/assets/${asset.replacedByAsset.id}`}>{asset.replacedByAsset.name}</Link></p>}</div></section>
      )}
    </div>
  );
}

function MaintenanceTab({ asset, locations, assetOptions }: { asset: AssetDetailView; locations: AssetLocationOption[]; assetOptions: AssetOptionView[] }) {
  return (
    <div className="asset-tab-stack">
      <div className="asset-tab-toolbar"><div><h2>Maintenance history</h2><p>Existing MaintenanceIssue records linked to this physical asset.</p></div>{asset.status === "ACTIVE" && <MaintenanceFormDialog propertyId={asset.propertyId} locations={locations} assetOptions={assetOptions} defaultAssetId={asset.id} defaultFloorId={asset.floorId} defaultSpaceId={asset.spaceId} trigger={<Button><Wrench /> Create maintenance issue</Button>} />}</div>
      {asset.maintenance.length ? <div className="asset-timeline">{asset.maintenance.map((item) => <article key={item.id}><span className={`asset-timeline-dot is-${item.status.toLowerCase()}`} /><div><div className="asset-history-head"><strong>{item.title}</strong><span>{formatDate(item.reportedAt)}</span></div><p>{item.description}</p><small>{item.priority.replace("_", " ")} · {item.status.replace("_", " ")}{item.costVnd !== "0" ? ` · ${formatVnd(item.costVnd)}` : ""}</small><Button asChild variant="ghost" size="sm"><Link href={`/operations/maintenance?issue=${item.id}`}>Open maintenance</Link></Button></div></article>)}</div> : <AssetEmpty title="No maintenance history" detail="Create an issue when this asset needs repair or attention." />}
    </div>
  );
}

function ExpensesTab({ asset, locations, assetOptions }: { asset: AssetDetailView; locations: AssetLocationOption[]; assetOptions: AssetOptionView[] }) {
  return (
    <div className="asset-tab-stack">
      <div className="asset-tab-toolbar"><div><h2>Linked expenses</h2><p>Owner costs remain sourced from the Expenses module.</p></div><ExpenseFormDialog propertyId={asset.propertyId} locations={locations} maintenanceOptions={[]} assetOptions={assetOptions} defaultAssetId={asset.id} defaultFloorId={asset.floorId} defaultSpaceId={asset.spaceId} trigger={<Button variant="outline"><ReceiptText /> Add expense</Button>} /></div>
      <div className="asset-cost-breakdown"><span>Purchase <strong>{asset.purchasePriceVnd ? formatVnd(asset.purchasePriceVnd) : "0 đ"}</strong></span><span>Linked expenses <strong>{formatVnd(asset.linkedExpenseTotalVnd)}</strong></span><span>Lifetime <strong>{formatVnd(asset.lifetimeCostVnd)}</strong></span></div>
      {asset.expenses.length ? <div className="asset-simple-list">{asset.expenses.map((expense) => <article key={expense.id}><div><strong>{expense.description}</strong><span>{formatDate(expense.expenseDate)} · {expense.category}</span>{expense.maintenanceTitle && <small>Maintenance · {expense.maintenanceTitle}</small>}</div><strong>{formatVnd(expense.amountVnd)}</strong></article>)}</div> : <AssetEmpty title="No linked expenses" detail="Asset lifetime cost currently contains purchase price only." />}
    </div>
  );
}

function DocumentsTab({ asset }: { asset: AssetDetailView }) {
  const photos = asset.attachments.filter((item) => item.type === "PHOTO");
  const documents = asset.attachments.filter((item) => item.type !== "PHOTO");
  return (
    <div className="asset-tab-stack">
      <div className="asset-tab-toolbar"><div><h2>Documents & photos</h2><p>Private purchase, warranty, manual, serial, and other records.</p></div><AssetDocumentDialog propertyId={asset.propertyId} assetId={asset.id} /></div>
      <PhotoGallery photos={photos} />
      {documents.length ? <div className="asset-document-list">{documents.map((item) => <article key={item.id}><div><FileText /><span><strong>{item.title || documentTypeLabel(item.type)}</strong><small>{documentTypeLabel(item.type)} · {formatDate(item.createdAt.slice(0, 10))}</small></span></div><AssetAttachmentActions propertyId={asset.propertyId} assetId={asset.id} attachment={item} /></article>)}</div> : <AssetEmpty title="No asset documents" detail="Add a purchase receipt, warranty, manual, serial label, or custom document." />}
    </div>
  );
}

function PhotoGallery({ photos }: { photos: AssetDetailView["attachments"] }) {
  const [index, setIndex] = React.useState(0);
  if (!photos.length) return <div className="asset-photo-empty"><ImageIcon /><span>No asset photos.</span></div>;
  const current = photos[Math.min(index, photos.length - 1)]!;
  return (
    <section className="asset-photo-section">
      <div className="asset-section-heading"><strong>Photos</strong><span>{photos.length} attached</span></div>
      <div className="asset-photo-thumbnails">{photos.map((photo, photoIndex) => <button key={photo.id} type="button" className={index === photoIndex ? "is-active" : ""} onClick={() => setIndex(photoIndex)}><img src={photo.url} alt="" /></button>)}</div>
      <Dialog><DialogTrigger asChild><button type="button" className="asset-photo-viewer-trigger"><img src={current.url} alt="Selected asset" /></button></DialogTrigger><DialogContent className="asset-photo-dialog"><DialogHeader><DialogTitle>Asset photos · {index + 1} / {photos.length}</DialogTitle></DialogHeader><div className="asset-photo-viewer"><img src={current.url} alt="Asset attachment" />{photos.length > 1 && <><button type="button" className="is-prev" onClick={() => setIndex((value) => (value - 1 + photos.length) % photos.length)}><ChevronLeft /></button><button type="button" className="is-next" onClick={() => setIndex((value) => (value + 1) % photos.length)}><ChevronRight /></button></>}</div></DialogContent></Dialog>
    </section>
  );
}

function HistoryTab({ asset }: { asset: AssetDetailView }) {
  return (
    <div className="asset-tab-stack">
      {(asset.replacementForAsset || asset.replacedByAsset) && (
        <section className="asset-replacement-chain"><History /><div><strong>Replacement relationship</strong>{asset.replacementForAsset && <p>Replaces <Link href={`/assets/${asset.replacementForAsset.id}`}>{asset.replacementForAsset.name}</Link> · {asset.replacementForAsset.status}</p>}{asset.replacedByAsset && <p>Replaced by <Link href={`/assets/${asset.replacedByAsset.id}`}>{asset.replacedByAsset.name}</Link> · {asset.replacedByAsset.status}</p>}</div></section>
      )}
      {asset.history.length ? <div className="asset-timeline">{asset.history.map((item) => <article key={item.id}><span className={`asset-timeline-dot is-${item.tone}`} /><div><div className="asset-history-head"><strong>{item.title}</strong><span>{formatDate(item.date)}</span></div>{item.detail && <p>{item.detail.match(/^\d+$/) ? formatVnd(item.detail) : item.detail}</p>}</div></article>)}</div> : <AssetEmpty title="No history yet" detail="Lifecycle and operational history will appear as records are created." />}
    </div>
  );
}

function AssetEmpty({ title, detail }: { title: string; detail: string }) {
  return <div className="asset-empty-state is-compact"><History /><strong>{title}</strong><p>{detail}</p></div>;
}

function documentTypeLabel(type: string) {
  return { RECEIPT: "Purchase receipt", WARRANTY: "Warranty", MANUAL: "Manual", SERIAL: "Serial label", OTHER: "Other", PHOTO: "Photo" }[type] || type;
}
