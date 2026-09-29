import {
  mediaContentType,
  PERSON_MEDIA_KINDS,
} from "@/modules/people/server/private-storage";
import { getPersonMedia } from "@/modules/people/server/media";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ personId: string; kind: string }> },
) {
  const { personId, kind } = await context.params;
  if (!PERSON_MEDIA_KINDS.includes(kind as never)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const media = await getPersonMedia(
      personId,
      kind as (typeof PERSON_MEDIA_KINDS)[number],
    );
    if (!media) return new Response("Not found", { status: 404 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(media.bytes), {
      headers: {
        "Content-Type": mediaContentType(media.key),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${kind}.${media.key.split(".").at(-1) ?? "img"}"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
