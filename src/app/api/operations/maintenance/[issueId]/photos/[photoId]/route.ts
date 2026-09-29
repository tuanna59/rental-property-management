import { localPrivateStorage } from "@/modules/people/server/private-storage";
import { getMaintenancePhotoStorageKey } from "@/modules/operations/server/operations.queries";
import { operationMediaContentType } from "@/modules/operations/server/private-media";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ issueId: string; photoId: string }> },
) {
  const { issueId, photoId } = await params;
  const key = await getMaintenancePhotoStorageKey(issueId, photoId);
  if (!key) return new Response("Not found", { status: 404 });
  try {
    const bytes = await localPrivateStorage.get(key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": operationMediaContentType(key),
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
