import { createTranslator } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthLocale, formatNumberLocale, formatVndLocale } from "@/i18n/format";
import { getMessages } from "@/i18n/messages";
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

export function invoicePresentation(invoice: Invoice, locale: AppLocale) {
  const t = billingTranslator(locale);
  const lines: InvoiceLinePresentation[] = [
    ...invoice.lines.map((line) => linePresentation(line, locale, t)),
    ...invoice.adjustments.map((adjustment) => ({
      id: adjustment.id,
      type: "ADJUSTMENT",
      label: adjustment.type === "CREDIT" ? t("creditAdjustment") : t("debitAdjustment"),
      detail: adjustment.reason || adjustment.description,
      detailNote: null,
      quantity: "—",
      rate: "—",
      amount: `${adjustment.type === "CREDIT" ? "−" : ""}${formatVndLocale(adjustment.amount, locale)}`,
    })),
  ];

  return {
    propertyName: invoice.propertyName,
    invoiceNumber: `${invoice.type === "FINAL_SETTLEMENT" ? "FS" : "INV"}-${invoice.id.slice(-6).toUpperCase()}`,
    documentTitle:
      invoice.type === "FINAL_SETTLEMENT" ? t("finalSettlementDocument") : t("invoiceDocument"),
    statusLabel:
      invoice.status === "DRAFT"
        ? t("draftWatermark")
        : invoice.status === "VOIDED"
          ? t("voided")
          : t("finalizedLabel"),
    billTo: invoice.renterName,
    room: invoice.room,
    billingLabel:
      invoice.type === "FINAL_SETTLEMENT" ? t("billingLabelFinal") : t("billingLabelRegular"),
    billingValue:
      invoice.type === "FINAL_SETTLEMENT"
        ? formatDateOnlyLocale(invoice.invoiceDate, locale)
        : formatMonthLocale(invoice.billingPeriod, locale),
    moveOut:
      invoice.type === "FINAL_SETTLEMENT"
        ? formatDateOnlyLocale(invoice.invoiceDate, locale)
        : null,
    lines,
    originalTotal: invoice.originalTotal,
    adjustmentNet: invoice.adjustmentNet,
    total: invoice.total,
    paid: invoice.totalPaid,
    outstanding: invoice.balance,
    hasAdjustments: invoice.hasAdjustments,
    isDraft: invoice.status === "DRAFT",
    isVoided: invoice.status === "VOIDED",
  };
}

export function exportInvoicePng(invoice: Invoice, locale: AppLocale) {
  const t = billingTranslator(locale);
  const presentation = invoicePresentation(invoice, locale);
  const canvas = document.createElement("canvas");
  const rowHeight = 104;
  canvas.width = 1600;
  canvas.height = Math.max(980, 650 + presentation.lines.length * rowHeight + (presentation.hasAdjustments ? 170 : 0));
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
  context.fillText(t("rentalUtilitiesManagement"), 132, 120);

  context.textAlign = "right";
  context.fillStyle = colors.greenDark;
  context.font = `800 54px ${font}`;
  context.fillText(presentation.documentTitle, 1520, 86);
  context.fillStyle = colors.muted;
  context.font = `650 23px ${font}`;
  context.fillText(`#${presentation.invoiceNumber}`, 1520, 122);
  if (presentation.isDraft || presentation.isVoided) {
    context.fillStyle = presentation.isVoided ? "#9c3c2f" : "#8b6a2d";
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
  drawLabel(context, t("tenantUpper"), presentation.billTo, 72, 198, colors, font);
  drawLabel(context, t("roomUpper"), presentation.room, 610, 198, colors, font);
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
  context.fillText(t("itemUpper"), 96, y + 37);
  context.fillText(t("detailCalculationUpper"), x.detail, y + 37);
  context.fillText(t("quantityUsageUpper"), x.quantity, y + 37);
  context.fillText(t("rateUpper"), x.rate, y + 37);
  context.textAlign = "right";
  context.fillText(t("amountUpper"), x.amount, y + 37);
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
  const totalHeight = presentation.hasAdjustments ? 260 : 104;
  context.fillStyle = colors.greenDark;
  roundRect(context, totalX, y, totalWidth, totalHeight, 4);
  context.fill();
  context.fillStyle = colors.white;
  if (presentation.hasAdjustments) {
    context.font = `600 20px ${font}`;
    context.fillText(t("originalTotal"), totalX + 38, y + 42);
    context.textAlign = "right";
    context.fillText(formatVndLocale(presentation.originalTotal, locale), 1490, y + 42);
    context.textAlign = "left";
    context.fillText(t("adjustments"), totalX + 38, y + 82);
    context.textAlign = "right";
    context.fillText(formatVndLocale(presentation.adjustmentNet, locale), 1490, y + 82);
    context.textAlign = "left";
    context.font = `700 24px ${font}`;
    context.fillText(t("adjustedTotal"), totalX + 38, y + 132);
    context.textAlign = "right";
    context.font = `800 30px ${font}`;
    context.fillText(formatVndLocale(presentation.total, locale), 1490, y + 132);
    context.textAlign = "left";
    context.font = `600 20px ${font}`;
    context.fillText(t("paid"), totalX + 38, y + 180);
    context.textAlign = "right";
    context.fillText(formatVndLocale(presentation.paid, locale), 1490, y + 180);
    context.textAlign = "left";
    context.fillText(t("outstanding"), totalX + 38, y + 220);
    context.textAlign = "right";
    context.fillText(formatVndLocale(presentation.outstanding, locale), 1490, y + 220);
    context.textAlign = "left";
  } else {
    context.font = `700 28px ${font}`;
    context.fillText(t("totalPaymentUpper"), totalX + 38, y + 65);
    context.textAlign = "right";
    context.font = `800 36px ${font}`;
    context.fillText(formatVndLocale(presentation.total, locale), 1490, y + 66);
    context.textAlign = "left";
  }

  // Footer
  const footerY = canvas.height - 70;
  context.fillStyle = colors.greenDark;
  context.font = `700 18px ${font}`;
  context.fillText(presentation.propertyName, 72, footerY - 22);
  context.fillStyle = colors.muted;
  context.font = `400 16px ${font}`;
  context.fillText(
    presentation.isDraft
      ? t("draftPreviewFooter")
      : presentation.isVoided
        ? t("voidedInvoiceFooter")
        : t("electronicInvoiceCreated"),
    72,
    footerY + 5,
  );
  context.textAlign = "right";
  context.fillText(t("thankYouOnTime"), 1528, footerY + 5);
  context.textAlign = "left";

  const link = document.createElement("a");
  link.download = `${invoice.billingPeriod.toISOString().slice(0, 7)}_${sanitizeSegment(invoice.room)}_${sanitizeSegment(invoice.renterName)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function linePresentation(
  line: Invoice["lines"][number],
  locale: AppLocale,
  t: ReturnType<typeof billingTranslator>,
): InvoiceLinePresentation {
  const metadata = line.metadata as Record<string, unknown>;
  const period = line.sourceBillingMonth
    ? formatMonthLocale(line.sourceBillingMonth, locale)
    : "—";

  if (line.type === "RENT") {
    const fullMonth = Boolean(metadata.fullMonth);
    const days = Number(metadata.billableDays ?? 0);
    const monthlyRent = formatVndLocale(String(metadata.monthlyRentVnd ?? 0), locale);
    return {
      id: line.id,
      type: line.type,
      label: t("rent"),
      detail: t("rentPeriodDetail", { period }),
      detailNote: servicePeriodText(line.servicePeriodStart, line.servicePeriodEnd, locale),
      quantity: fullMonth ? `1 ${t("monthUnit")}` : t("daysCount", { count: days }),
      rate: `${monthlyRent}${t("rateUnitMonth")}`,
      amount: formatVndLocale(line.finalAmount, locale),
    };
  }

  if (line.type === "ELECTRICITY") {
    const kwh = String(metadata.tenantKwh ?? 0);
    return {
      id: line.id,
      type: line.type,
      label: t("electricity"),
      detail: t("electricityPeriodDetail", { period }),
      detailNote: meterReadingSummary(metadata, locale, t),
      quantity: `${kwh} kWh`,
      rate: `${formatVndLocale(String(metadata.applicableRate ?? 0), locale)}/kWh`,
      amount: formatVndLocale(line.finalAmount, locale),
    };
  }

  const occupants = Array.isArray(metadata.occupants)
    ? (metadata.occupants as Array<Record<string, unknown>>)
    : [];
  return {
    id: line.id,
    type: line.type,
    label: t("water"),
    detail: t("waterPeriodDetail", { period }),
    detailNote: t("peopleCount", { count: occupants.length }),
    quantity: t("peopleCount", { count: occupants.length }),
    rate: t("perPersonPerMonth", { rate: formatVndLocale(String(metadata.applicableRate ?? 0), locale) }),
    amount: formatVndLocale(line.finalAmount, locale),
  };
}

function meterReadingSummary(metadata: Record<string, unknown>, locale: AppLocale, t: ReturnType<typeof billingTranslator>) {
  const segments = Array.isArray(metadata.meterSegments)
    ? (metadata.meterSegments as Array<Record<string, unknown>>)
    : [];
  if (segments.length === 1) {
    const opening = segments[0].openingReading as Record<string, unknown> | null;
    const closing = segments[0].closingReading as Record<string, unknown> | null;
    if (opening?.value != null && closing?.value != null) {
      return t("meterReadingSummary", { opening: formatRegister(opening.value, locale), closing: formatRegister(closing.value, locale) });
    }
  }
  if (segments.length > 1) return t("meterCycleCount", { count: segments.length });
  return null;
}

function servicePeriodText(start: Date | null, end: Date | null, locale: AppLocale) {
  if (!start || !end) return null;
  return `${formatDateOnlyLocale(start, locale)} – ${formatDateOnlyLocale(end, locale)}`;
}

function formatRegister(value: unknown, locale: AppLocale) {
  const number = Number(value);
  return Number.isFinite(number)
    ? formatNumberLocale(number, locale, { maximumFractionDigits: 3 })
    : String(value);
}

function billingTranslator(locale: AppLocale) {
  return createTranslator({
    locale,
    messages: getMessages(locale),
    namespace: "billing",
  });
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
