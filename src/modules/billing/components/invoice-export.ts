import { formatDate, formatVnd } from "@/lib/presentation";
import type { getInvoices } from "../server/billing.queries";

type Invoice = Awaited<ReturnType<typeof getInvoices>>[number];

export function invoicePresentation(invoice: Invoice) {
  const month = invoice.billingPeriod.toISOString().slice(0, 7);
  return {
    propertyName: invoice.propertyName,
    invoiceNumber: `INV-${month}-${sanitize(invoice.room).toUpperCase()}`,
    status: invoice.status,
    billTo: invoice.renterName,
    room: invoice.room,
    billingPeriod: monthLabel(invoice.billingPeriod),
    servicePeriod: `${formatDate(invoice.serviceStart)} – ${formatDate(invoice.serviceEnd)}`,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      label: title(line.type),
      calculation: lineCalculation(line.type, line.metadata),
      amount: line.finalAmount,
    })),
    total: invoice.total,
  };
}

export function exportInvoicePng(invoice: Invoice) {
  const presentation = invoicePresentation(invoice);
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 920 + presentation.lines.length * 105;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = "#faf7f0";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#173b2c";
  context.font = "700 28px sans-serif";
  context.fillText(presentation.propertyName, 80, 82);
  context.textAlign = "right";
  context.font = "700 52px sans-serif";
  context.fillText("INVOICE", 1320, 82);
  context.font = "600 22px sans-serif";
  context.fillStyle = "#52645d";
  context.fillText(`#${presentation.invoiceNumber}`, 1320, 120);
  context.textAlign = "left";

  if (presentation.status === "DRAFT") {
    context.fillStyle = "#efe3c4";
    context.fillRect(80, 120, 120, 38);
    context.fillStyle = "#71582b";
    context.font = "700 18px sans-serif";
    context.fillText("DRAFT", 105, 146);
  }

  context.strokeStyle = "#2c6957";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(80, 185);
  context.lineTo(1320, 185);
  context.stroke();

  drawLabel(context, "BILL TO", presentation.billTo, 80, 245);
  drawLabel(context, "ROOM", presentation.room, 550, 245);
  drawLabel(context, "BILLING PERIOD", presentation.billingPeriod, 820, 245);
  drawLabel(context, "SERVICE PERIOD", presentation.servicePeriod, 820, 325);

  let y = 435;
  context.fillStyle = "#e9eee9";
  context.fillRect(80, y - 35, 1240, 58);
  context.fillStyle = "#41554e";
  context.font = "700 18px sans-serif";
  context.fillText("ITEM", 105, y);
  context.fillText("CALCULATION", 410, y);
  context.textAlign = "right";
  context.fillText("AMOUNT", 1295, y);
  context.textAlign = "left";
  y += 85;

  presentation.lines.forEach((line) => {
    context.fillStyle = "#20362f";
    context.font = "700 22px sans-serif";
    context.fillText(line.label, 105, y);
    context.fillStyle = "#5b6b65";
    context.font = "20px sans-serif";
    context.fillText(line.calculation, 410, y);
    context.fillStyle = "#20362f";
    context.font = "700 22px sans-serif";
    context.textAlign = "right";
    context.fillText(formatVnd(line.amount), 1295, y);
    context.textAlign = "left";
    context.strokeStyle = "#dddeda";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(80, y + 35);
    context.lineTo(1320, y + 35);
    context.stroke();
    y += 105;
  });

  y += 35;
  context.fillStyle = "#173b2c";
  context.fillRect(760, y - 40, 560, 92);
  context.fillStyle = "#ffffff";
  context.font = "700 25px sans-serif";
  context.fillText("TOTAL", 800, y + 15);
  context.textAlign = "right";
  context.font = "700 30px sans-serif";
  context.fillText(formatVnd(presentation.total), 1280, y + 15);
  context.textAlign = "left";

  context.fillStyle = "#687770";
  context.font = "18px sans-serif";
  context.fillText(
    presentation.status === "DRAFT"
      ? "Draft invoice · not finalized"
      : "Finalized invoice",
    80,
    canvas.height - 75,
  );

  const link = document.createElement("a");
  link.download = `${invoice.billingPeriod.toISOString().slice(0, 7)}_${sanitize(invoice.room)}_${sanitize(invoice.renterName)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  context.fillStyle = "#718079";
  context.font = "700 16px sans-serif";
  context.fillText(label, x, y);
  context.fillStyle = "#20362f";
  context.font = "600 22px sans-serif";
  context.fillText(value, x, y + 32);
}

function lineCalculation(type: string, metadata: unknown) {
  const item = metadata as Record<string, unknown>;
  if (type === "RENT") {
    const rent = formatVnd(String(item.monthlyRentVnd ?? 0));
    return item.fullMonth
      ? `${rent} monthly rent`
      : `${rent} × ${item.billableDays} / 30`;
  }
  if (type === "ELECTRICITY") {
    return `${item.tenantKwh ?? 0} kWh × ${formatVnd(String(item.applicableRate ?? 0))}/kWh`;
  }
  const occupants = Array.isArray(item.occupants)
    ? (item.occupants as Array<Record<string, unknown>>)
    : [];
  const days = occupants.reduce(
    (sum, occupant) => sum + Number(occupant.billableDays ?? 0),
    0,
  );
  return `${occupants.length} ${occupants.length === 1 ? "person" : "people"} · ${days} occupant-days`;
}

export function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function title(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function sanitize(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "invoice"
  );
}
