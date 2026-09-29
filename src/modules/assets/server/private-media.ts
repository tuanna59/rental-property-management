import { randomUUID } from "node:crypto";

import {
  localPrivateStorage,
  validatePrivateDocument,
  validatePrivateImage,
} from "@/modules/people/server/private-storage";

import type { AssetAttachmentType } from "../domain/types";

function safeId(value: string) {
  if (!/^[a-z0-9_-]+$/i.test(value)) throw new Error("Invalid media destination.");
  return value;
}

export async function storeAssetAttachment(
  propertyId: string,
  assetId: string,
  type: AssetAttachmentType,
  file: File,
) {
  const validated = type === "PHOTO"
    ? await validatePrivateImage(file)
    : await validatePrivateDocument(file);
  const key = `assets/${safeId(propertyId)}/${safeId(assetId)}/${type.toLowerCase()}/${randomUUID()}.${validated.extension}`;
  await localPrivateStorage.put(key, validated.bytes);
  return key;
}

export async function removePrivateAssetFile(key: string | null | undefined) {
  if (!key) return;
  await localPrivateStorage.delete(key);
}

export function assetMediaContentType(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  throw new Error("Unsupported private asset media type.");
}
