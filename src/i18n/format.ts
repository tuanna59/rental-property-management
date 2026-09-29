import type { AppLocale } from "./config";

function localeTag(locale: AppLocale) {
  return locale === "vi" ? "vi-VN" : "en-US";
}

function numericValue(value: string | number | bigint) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnlyToUtc(value: string | Date) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDateOnlyLocale(value: string | Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToUtc(value));
}


export function formatCompactDateLocale(value: string | Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToUtc(value));
}

export function formatMonthAxisLocale(value: string | Date, locale: AppLocale) {
  const date = value instanceof Date
    ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
    : /^\d{4}-\d{2}$/.test(value)
      ? new Date(`${value}-01T00:00:00Z`)
      : dateOnlyToUtc(value);
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthShortLocale(value: string | Date, locale: AppLocale) {
  const date = value instanceof Date
    ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
    : /^\d{4}-\d{2}$/.test(value)
      ? new Date(`${value}-01T00:00:00Z`)
      : dateOnlyToUtc(value);
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
export function formatMonthLocale(value: string | Date, locale: AppLocale) {
  const date = value instanceof Date
    ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
    : /^\d{4}-\d{2}$/.test(value)
      ? new Date(`${value}-01T00:00:00Z`)
      : dateOnlyToUtc(value);
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export function formatNumberLocale(
  value: string | number | bigint,
  locale: AppLocale,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(localeTag(locale), options).format(numericValue(value));
}

export function formatVndLocale(value: string | number | bigint, locale: AppLocale) {
  return `${new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(numericValue(value))} ₫`;
}

export function formatPercentLocale(value: number, locale: AppLocale, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "percent",
    maximumFractionDigits,
  }).format(value / 100);
}
