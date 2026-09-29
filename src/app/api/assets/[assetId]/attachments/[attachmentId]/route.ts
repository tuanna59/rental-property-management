import { getAssetAttachmentStorageKey } from "@/modules/assets/server/assets.queries";
import { assetMediaContentType } from "@/modules/assets/server/private-media";
import { localPrivateStorage } from "@/modules/people/server/private-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string; attachmentId: string }> },
) {
  const { assetId, attachmentId } = await params;
  const key = await getAssetAttachmentStorageKey(assetId, attachmentId);
  if (!key) return new Response("Not found", { status: 404 });
  try {
    const bytes = await localPrivateStorage.get(key);
    const contentType = assetMediaContentType(key);
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (contentType === "application/pdf") {
      headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    }
    return new Response(new Uint8Array(bytes), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
