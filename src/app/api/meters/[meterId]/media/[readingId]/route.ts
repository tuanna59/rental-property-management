import { mediaContentType } from "@/modules/people/server/private-storage";
import { getMeterReadingPhoto } from "@/modules/utilities/server/meter-media";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ meterId: string; readingId: string }> },
) {
  const { meterId, readingId } = await context.params;
  try {
    const media = await getMeterReadingPhoto(meterId, readingId);
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
