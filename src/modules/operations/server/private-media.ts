import { randomUUID } from "node:crypto";

import {
  localPrivateStorage,
  validatePrivateDocument,
  validatePrivateImage,
} from "@/modules/people/server/private-storage";

function safeId(value: string) {
  if (!/^[a-z0-9_-]+$/i.test(value)) throw new Error("Invalid media destination.");
  return value;
}

export async function storeExpenseReceipt(
  propertyId: string,
  expenseId: string,
  file: File,
) {
  const validated = await validatePrivateDocument(file);
  const key = `operations/${safeId(propertyId)}/expenses/${safeId(expenseId)}/${randomUUID()}.${validated.extension}`;
  await localPrivateStorage.put(key, validated.bytes);
  return key;
}

export async function storeMaintenancePhoto(
  propertyId: string,
  issueId: string,
  file: File,
) {
  const validated = await validatePrivateImage(file);
  const key = `operations/${safeId(propertyId)}/maintenance/${safeId(issueId)}/${randomUUID()}.${validated.extension}`;
  await localPrivateStorage.put(key, validated.bytes);
  return key;
}

export async function removePrivateOperationFile(key: string | null | undefined) {
  if (!key) return;
  await localPrivateStorage.delete(key);
}

export function operationMediaContentType(key: string) {
  if (key.endsWith(".jpg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".pdf")) return "application/pdf";
  throw new Error("Unsupported private media type.");
}
