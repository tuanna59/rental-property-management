import { getPersonDocument } from "@/modules/people/server/documents";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ personId: string; documentId: string }> },
) {
  const { personId, documentId } = await context.params;
  try {
    const document = await getPersonDocument(personId, documentId);
    if (!document) return new Response("Not found", { status: 404 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const safeName = document.fileName.replace(/[\r\n"]/g, "_");
    return new Response(new Uint8Array(document.bytes), {
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
