export class PeopleDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeopleDomainError";
  }
}

export function normalizeCitizenId(value: string) {
  const normalized = value.trim().replace(/[\s.-]/g, "");
  if (!/^\d+$/.test(normalized) || ![9, 12].includes(normalized.length)) {
    throw new PeopleDomainError(
      "Citizen ID must be a 12-digit CCCD or 9-digit legacy CMND.",
    );
  }
  return normalized;
}

export function citizenIdLast4(value: string) {
  return normalizeCitizenId(value).slice(-4);
}

export function normalizeVietnamesePhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");

  if (/^\+84\d{9,10}$/.test(compact)) return compact;
  if (/^84\d{9,10}$/.test(compact)) return `+${compact}`;
  if (/^0\d{9,10}$/.test(compact)) return `+84${compact.slice(1)}`;

  throw new PeopleDomainError(
    "Phone must be a Vietnamese number using 0, 84, or +84 format.",
  );
}
