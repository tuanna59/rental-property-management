import { notFound } from "next/navigation";

import { AssetDetailWorkspace } from "@/modules/assets/components/asset-detail";
import { AssetsShell } from "@/modules/assets/components/assets-shell";
import { getAssetDetail, getAssetInventoryPage, getAssetOptions } from "@/modules/assets/server/assets.queries";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await getAssetDetail(assetId);
  if (!asset) notFound();
  const [inventory, assetOptions] = await Promise.all([
    getAssetInventoryPage(asset.propertyId),
    getAssetOptions(asset.propertyId),
  ]);
  return (
    <AssetsShell>
      <AssetDetailWorkspace asset={asset} categories={inventory.categories} locations={inventory.locations} assetOptions={assetOptions} />
    </AssetsShell>
  );
}
