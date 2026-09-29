import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const PERSON_MEDIA_KINDS = [
  "avatar",
  "citizen-front",
  "citizen-back",
] as const;
export type PersonMediaKind = (typeof PERSON_MEDIA_KINDS)[number];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const imageTypes = {
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] },
} as const;

export interface PrivateStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

function rootDirectory() {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.PRIVATE_DATA_DIR || "private-data",
  );
}

function resolveStorageKey(key: string) {
  if (!/^[a-z0-9][a-z0-9/_-]*\.(jpg|png|webp|pdf|json)$/.test(key)) {
    throw new Error("Invalid private storage key.");
  }
  const root = rootDirectory();
  const resolved = path.resolve(root, ...key.split("/"));
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid private storage key.");
  }
  return resolved;
}

export const localPrivateStorage: PrivateStorage = {
  async put(key, bytes) {
    const target = resolveStorageKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  },
  get(key) {
    return readFile(resolveStorageKey(key));
  },
  async delete(key) {
    try {
      await unlink(resolveStorageKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  },
};

function detectedImageType(bytes: Uint8Array) {
  for (const [mime, details] of Object.entries(imageTypes)) {
    const matches = details.signature.every(
      (byte, index) => bytes[index] === byte,
    );
    if (matches) {
      if (mime === "image/webp") {
        const marker = new TextDecoder().decode(bytes.slice(8, 12));
        if (marker !== "WEBP") continue;
      }
      return { mime, extension: details.extension };
    }
  }
  return null;
}

export async function validatePrivateImage(file: File) {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 8 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectedImageType(bytes);
  if (!detected || detected.mime !== file.type) {
    throw new Error("Choose a valid JPEG, PNG, or WebP image.");
  }
  return { bytes, ...detected };
}

export async function validatePrivateDocument(file: File) {
  if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("Choose a document smaller than 16 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf") {
    const marker = new TextDecoder().decode(bytes.slice(0, 5));
    if (marker !== "%PDF-") throw new Error("Choose a valid PDF or image document.");
    return { bytes, mime: "application/pdf", extension: "pdf" };
  }
  const detected = detectedImageType(bytes);
  if (!detected || detected.mime !== file.type) {
    throw new Error("Choose a valid PDF, JPEG, PNG, or WebP document.");
  }
  return { bytes, ...detected };
}

export function createPersonDocumentKey(
  personId: string,
  documentId: string,
  extension: string,
) {
  if (
    !/^[a-z0-9_-]+$/i.test(personId) ||
    !/^[a-z0-9_-]+$/i.test(documentId) ||
    !["pdf", "jpg", "png", "webp"].includes(extension)
  ) {
    throw new Error("Invalid private document destination.");
  }
  return `people/${personId}/documents/${documentId}.${extension}`;
}

export function createPersonMediaKey(
  personId: string,
  kind: PersonMediaKind,
  extension: string,
) {
  if (!/^[a-z0-9_-]+$/i.test(personId) || !PERSON_MEDIA_KINDS.includes(kind)) {
    throw new Error("Invalid private media destination.");
  }
  return `people/${personId}/${kind}/${randomUUID()}.${extension}`;
}

export function mediaContentType(key: string) {
  if (key.endsWith(".jpg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  throw new Error("Unsupported private media type.");
}
