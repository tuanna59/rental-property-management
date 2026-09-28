import { mediaContentType } from "@/modules/people/server/private-storage";
import { getMeterReadingPhoto } from "@/modules/utilities/server/meter-media";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ meterId: string; readingId: string }> },
) {
  const { meterId, readingId } = await context.params;
  const requestedIndex = Number(new URL(request.url).searchParams.get("index") ?? "0");
  const index = Number.isInteger(requestedIndex) && requestedIndex >= 0
    ? requestedIndex
    : 0;
  try {
    const media = await getMeterReadingPhoto(meterId, readingId, index);
    if (!media) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(media.bytes), {
      headers: {
        "Content-Type": mediaContentType(media.key),
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
