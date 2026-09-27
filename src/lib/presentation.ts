/** Stable display helpers for date-only business values and whole-VND amounts. */
function asUtcDate(value: Date | string) {
  return typeof value === "string"
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
}

export function toDateOnly(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(asUtcDate(value));
}

export function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(asUtcDate(value));
}

export function formatVnd(value: string | bigint) {
  if (typeof value === "string" && value.includes(".")) {
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 2,
    }).format(Number(value))} đ`;
  }
  return `${new Intl.NumberFormat("vi-VN").format(BigInt(value))} đ`;
}
