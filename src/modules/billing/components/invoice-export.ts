import { formatVnd } from "@/lib/presentation";
import type { getInvoices } from "../server/billing.queries";

type Invoice = Awaited<ReturnType<typeof getInvoices>>[number];

type InvoiceLinePresentation = {
  id: string;
  type: string;
  label: string;
  detail: string;
  detailNote: string | null;
  quantity: string;
  rate: string;
  amount: string;
};

export function invoicePresentation(invoice: Invoice) {
  const month = invoice.billingPeriod.toISOString().slice(0, 7);
  const lines: InvoiceLinePresentation[] = [
    ...invoice.lines.map((line) => linePresentation(line)),
    ...invoice.adjustments.map((adjustment) => ({
      id: adjustment.id,
      type: "ADJUSTMENT",
      label: adjustment.type === "CREDIT" ? "Giảm trừ" : "Phụ thu",
      detail: adjustment.description,
      detailNote: adjustment.reason || null,
      quantity: "—",
      rate: "—",
      amount: `${adjustment.type === "CREDIT" ? "−" : ""}${formatVnd(adjustment.amount)}`,
    })),
  ];

  return {
    propertyName: invoice.propertyName,
    invoiceNumber: `${invoice.type === "FINAL_SETTLEMENT" ? "FS" : "INV"}-${month}-${sanitizeSegment(invoice.room).toUpperCase()}`,
    documentTitle:
      invoice.type === "FINAL_SETTLEMENT" ? "QUYẾT TOÁN" : "HÓA ĐƠN",
    statusLabel: invoice.status === "DRAFT" ? "BẢN NHÁP" : "ĐÃ CHỐT",
    billTo: invoice.renterName,
    room: invoice.room,
    billingLabel:
      invoice.type === "FINAL_SETTLEMENT" ? "NGÀY HÓA ĐƠN" : "KỲ HÓA ĐƠN",
    billingValue:
      invoice.type === "FINAL_SETTLEMENT"
        ? formatViDate(invoice.invoiceDate)
        : viMonthLabel(invoice.billingPeriod),
    moveOut:
      invoice.type === "FINAL_SETTLEMENT"
        ? formatViDate(invoice.invoiceDate)
        : null,
    lines,
    total: invoice.total,
    isDraft: invoice.status === "DRAFT",
  };
}

export function exportInvoicePng(invoice: Invoice) {
  const presentation = invoicePresentation(invoice);
  const canvas = document.createElement("canvas");
  const rowHeight = 104;
  canvas.width = 1600;
  canvas.height = Math.max(980, 650 + presentation.lines.length * rowHeight);
  const context = canvas.getContext("2d");
  if (!context) return;

  const colors = {
    page: "#fbf9f4",
    ink: "#17352b",
    muted: "#65756f",
    green: "#1d755d",
    greenDark: "#124b3b",
    greenSoft: "#e8f2ed",
    tableHead: "#e8efeb",
    border: "#d9e1dc",
    white: "#ffffff",
  };
  const font = '"Source Sans 3", "Segoe UI", sans-serif';

  context.fillStyle = colors.page;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Header / property identity
  drawHouseMark(context, 72, 58, colors.greenDark, colors.greenSoft);
  context.fillStyle = colors.greenDark;
  context.font = `700 32px ${font}`;
  context.fillText(presentation.propertyName, 132, 90);
  context.fillStyle = colors.muted;
  context.font = `400 19px ${font}`;
  context.fillText("Quản lý tiền thuê và tiện ích", 132, 120);

  context.textAlign = "right";
  context.fillStyle = colors.greenDark;
  context.font = `800 54px ${font}`;
  context.fillText(presentation.documentTitle, 1520, 86);
  context.fillStyle = colors.muted;
  context.font = `650 23px ${font}`;
  context.fillText(`#${presentation.invoiceNumber}`, 1520, 122);
  if (presentation.isDraft) {
    context.fillStyle = "#8b6a2d";
    context.font = `700 17px ${font}`;
    context.fillText(presentation.statusLabel, 1520, 151);
  }
  context.textAlign = "left";

  context.strokeStyle = colors.green;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(72, 158);
  context.lineTo(1528, 158);
  context.stroke();

  // Billing context
  drawLabel(context, "NGƯỜI THUÊ", presentation.billTo, 72, 198, colors, font);
  drawLabel(context, "PHÒNG", presentation.room, 610, 198, colors, font);
  drawLabel(
    context,
    presentation.billingLabel,
    presentation.billingValue,
    920,
    198,
    colors,
    font,
  );

  // Table header
  let y = 278;
  const x = {
    item: 72,
    detail: 310,
    quantity: 830,
    rate: 1080,
    amount: 1510,
  };
  context.fillStyle = colors.tableHead;
  roundRect(context, 72, y, 1456, 58, 5);
  context.fill();
  context.fillStyle = "#40564e";
  context.font = `750 17px ${font}`;
  context.fillText("HẠNG MỤC", 96, y + 37);
  context.fillText("CHI TIẾT / CÁCH TÍNH", x.detail, y + 37);
  context.fillText("SỐ LƯỢNG / SỬ DỤNG", x.quantity, y + 37);
  context.fillText("ĐƠN GIÁ", x.rate, y + 37);
  context.textAlign = "right";
  context.fillText("THÀNH TIỀN", x.amount, y + 37);
  context.textAlign = "left";
  y += 70;

  presentation.lines.forEach((line) => {
    const rowCenter = y + 42;
    drawLineIcon(context, line.type, 100, rowCenter, colors);

    context.textBaseline = "middle";
    context.fillStyle = colors.ink;
    context.font = `700 23px ${font}`;
    context.fillText(line.label, 144, rowCenter);

    if (line.detailNote) {
      context.textBaseline = "alphabetic";
      context.font = `650 21px ${font}`;
      context.fillText(line.detail, x.detail, y + 33);
      context.fillStyle = colors.muted;
      context.font = `400 17px ${font}`;
      context.fillText(clipCanvasText(context, line.detailNote, 470), x.detail, y + 61);
      context.textBaseline = "middle";
    } else {
      context.font = `650 21px ${font}`;
      context.fillText(line.detail, x.detail, rowCenter);
    }

    context.fillStyle = colors.ink;
    context.font = `500 20px ${font}`;
    context.fillText(line.quantity, x.quantity, rowCenter);
    context.fillText(line.rate, x.rate, rowCenter);
    context.font = `700 23px ${font}`;
    context.textAlign = "right";
    context.fillText(line.amount, x.amount, rowCenter);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.strokeStyle = colors.border;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(72, y + 86);
    context.lineTo(1528, y + 86);
    context.stroke();
    y += rowHeight;
  });

  // Total block
  y += 16;
  const totalWidth = 650;
  const totalX = 1528 - totalWidth;
  context.fillStyle = colors.greenDark;
  roundRect(context, totalX, y, totalWidth, 104, 4);
  context.fill();
  context.fillStyle = colors.white;
  context.font = `700 28px ${font}`;
  context.fillText("TỔNG THANH TOÁN", totalX + 38, y + 65);
  context.textAlign = "right";
  context.font = `800 36px ${font}`;
  context.fillText(formatVnd(presentation.total), 1490, y + 66);
  context.textAlign = "left";

  // Footer
  const footerY = canvas.height - 70;
  context.fillStyle = colors.greenDark;
  context.font = `700 18px ${font}`;
  context.fillText(presentation.propertyName, 72, footerY - 22);
  context.fillStyle = colors.muted;
  context.font = `400 16px ${font}`;
  context.fillText(
    presentation.isDraft ? "Bản xem trước · chưa chốt" : "Hóa đơn điện tử được tạo bởi hệ thống.",
    72,
    footerY + 5,
  );
  context.textAlign = "right";
  context.fillText("Cảm ơn bạn đã thanh toán đúng hạn.", 1528, footerY + 5);
  context.textAlign = "left";

  const link = document.createElement("a");
  link.download = `${invoice.billingPeriod.toISOString().slice(0, 7)}_${sanitizeSegment(invoice.room)}_${sanitizeSegment(invoice.renterName)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function linePresentation(line: Invoice["lines"][number]): InvoiceLinePresentation {
  const metadata = line.metadata as Record<string, unknown>;
  const period = line.sourceBillingMonth
    ? viMonthLabel(line.sourceBillingMonth)
    : "—";

  if (line.type === "RENT") {
    const fullMonth = Boolean(metadata.fullMonth);
    const days = Number(metadata.billableDays ?? 0);
    const monthlyRent = formatVnd(String(metadata.monthlyRentVnd ?? 0));
    return {
      id: line.id,
      type: line.type,
      label: "Tiền phòng",
      detail: `Tiền phòng ${period}`,
      detailNote: servicePeriodText(line.servicePeriodStart, line.servicePeriodEnd),
      quantity: fullMonth ? "1 tháng" : `${days} ngày`,
      rate: `${monthlyRent}/tháng`,
      amount: formatVnd(line.finalAmount),
    };
  }

  if (line.type === "ELECTRICITY") {
    const kwh = String(metadata.tenantKwh ?? 0);
    return {
      id: line.id,
      type: line.type,
      label: "Điện",
      detail: `Điện sử dụng ${period}`,
      detailNote: meterReadingSummary(metadata),
      quantity: `${kwh} kWh`,
      rate: `${formatVnd(String(metadata.applicableRate ?? 0))}/kWh`,
      amount: formatVnd(line.finalAmount),
    };
  }

  const occupants = Array.isArray(metadata.occupants)
    ? (metadata.occupants as Array<Record<string, unknown>>)
    : [];
  return {
    id: line.id,
    type: line.type,
    label: "Nước",
    detail: `Nước sử dụng ${period}`,
    detailNote: `Tính theo ${occupants.length} người ở`,
    quantity: `${occupants.length} người`,
    rate: `${formatVnd(String(metadata.applicableRate ?? 0))}/người/tháng`,
    amount: formatVnd(line.finalAmount),
  };
}

function meterReadingSummary(metadata: Record<string, unknown>) {
  const segments = Array.isArray(metadata.meterSegments)
    ? (metadata.meterSegments as Array<Record<string, unknown>>)
    : [];
  if (segments.length === 1) {
    const opening = segments[0].openingReading as Record<string, unknown> | null;
    const closing = segments[0].closingReading as Record<string, unknown> | null;
    if (opening?.value != null && closing?.value != null) {
      return `Chỉ số công tơ: ${formatRegister(opening.value)} → ${formatRegister(closing.value)}`;
    }
  }
  if (segments.length > 1) return `Chu kỳ sử dụng qua ${segments.length} công tơ`;
  return null;
}

function servicePeriodText(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  return `${formatViDate(start)} – ${formatViDate(end)}`;
}

function formatRegister(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(number)
    : String(value);
}

function formatViDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function viMonthLabel(value: Date) {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(value);
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `tháng ${month}/${year}`;
}

function drawLabel(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  colors: { ink: string; muted: string },
  font: string,
) {
  context.fillStyle = colors.muted;
  context.font = `700 17px ${font}`;
  context.fillText(label, x, y);
  context.fillStyle = colors.ink;
  context.font = `700 24px ${font}`;
  context.fillText(value, x, y + 36);
}

function drawHouseMark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  background: string,
) {
  context.fillStyle = background;
  context.beginPath();
  context.arc(x + 24, y + 24, 30, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(x + 5, y + 24);
  context.lineTo(x + 24, y + 7);
  context.lineTo(x + 43, y + 24);
  context.moveTo(x + 11, y + 21);
  context.lineTo(x + 11, y + 43);
  context.lineTo(x + 37, y + 43);
  context.lineTo(x + 37, y + 21);
  context.stroke();
}

function drawLineIcon(
  context: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  colors: { green: string; greenSoft: string },
) {
  context.fillStyle = colors.greenSoft;
  context.beginPath();
  context.arc(x, y, 25, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = colors.green;
  context.fillStyle = colors.green;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (type === "RENT") {
    context.beginPath();
    context.moveTo(x - 12, y - 1);
    context.lineTo(x, y - 12);
    context.lineTo(x + 12, y - 1);
    context.moveTo(x - 8, y - 3);
    context.lineTo(x - 8, y + 12);
    context.lineTo(x + 8, y + 12);
    context.lineTo(x + 8, y - 3);
    context.stroke();
    return;
  }
  if (type === "ELECTRICITY") {
    context.beginPath();
    context.moveTo(x + 3, y - 14);
    context.lineTo(x - 8, y + 1);
    context.lineTo(x, y + 1);
    context.lineTo(x - 3, y + 14);
    context.lineTo(x + 10, y - 3);
    context.lineTo(x + 2, y - 3);
    context.closePath();
    context.fill();
    return;
  }
  if (type === "WATER") {
    context.beginPath();
    context.moveTo(x, y - 14);
    context.bezierCurveTo(x - 10, y - 2, x - 12, y + 5, x - 8, y + 11);
    context.bezierCurveTo(x - 4, y + 17, x + 4, y + 17, x + 8, y + 11);
    context.bezierCurveTo(x + 12, y + 5, x + 10, y - 2, x, y - 14);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(x - 8, y - 8);
  context.lineTo(x + 8, y + 8);
  context.moveTo(x + 8, y - 8);
  context.lineTo(x - 8, y + 8);
  context.stroke();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function clipCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) {
  if (context.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length && context.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
}

export function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function sanitizeSegment(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "invoice"
  );
}
