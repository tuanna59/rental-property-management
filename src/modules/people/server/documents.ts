import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

import {
  localPrivateStorage,
  validatePrivateDocument,
  createPersonDocumentKey,
} from "./private-storage";

export const PERSON_DOCUMENT_TYPES = ["RENTAL_CONTRACT", "CUSTOM"] as const;
export type PersonDocumentType = (typeof PERSON_DOCUMENT_TYPES)[number];

export type PersonDocumentSummary = {
  id: string;
  type: PersonDocumentType;
  title: string;
  note: string | null;
  fileName: string;
  contentType: string;
  uploadedAt: Date;
  tenancyId: string | null;
};

type StoredPersonDocument = Omit<PersonDocumentSummary, "uploadedAt"> & {
  uploadedAt: string;
  storageKey: string;
};

type DocumentManifest = {
  version: 1;
  documents: StoredPersonDocument[];
};

function manifestKey(personId: string) {
  if (!/^[a-z0-9_-]+$/i.test(personId)) throw new Error("Invalid person id.");
  return `people/${personId}/documents/index.json`;
}

async function readManifest(personId: string): Promise<DocumentManifest> {
  try {
    const bytes = await localPrivateStorage.get(manifestKey(personId));
    const parsed = JSON.parse(bytes.toString("utf8")) as Partial<DocumentManifest>;
    return {
      version: 1,
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, documents: [] };
    }
    throw error;
  }
}

async function writeManifest(personId: string, manifest: DocumentManifest) {
  await localPrivateStorage.put(
    manifestKey(personId),
    Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
  );
}

async function ensurePerson(personId: string, requireActive = false) {
  const person = await prisma.person.findFirst({
    where: { id: personId, ...(requireActive ? { archivedAt: null } : {}) },
    select: { id: true },
  });
  if (!person) throw new Error("The selected person was not found.");
}

export async function listPersonDocuments(personId: string): Promise<PersonDocumentSummary[]> {
  const manifest = await readManifest(personId);
  return manifest.documents
    .map(({ storageKey: _storageKey, uploadedAt, ...document }) => ({
      ...document,
      uploadedAt: new Date(uploadedAt),
    }))
    .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime());
}

export async function addPersonDocument(input: {
  personId: string;
  type: PersonDocumentType;
  title?: string;
  note?: string;
  tenancyId?: string | null;
  file: File;
}) {
  await ensurePerson(input.personId, true);
  if (!PERSON_DOCUMENT_TYPES.includes(input.type)) throw new Error("Choose a valid document type.");
  const title = input.type === "RENTAL_CONTRACT" ? "Rental contract" : input.title?.trim();
  if (!title) throw new Error("Enter a title for the custom document.");

  if (input.tenancyId) {
    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: input.tenancyId,
        occupants: { some: { personId: input.personId } },
      },
      select: { id: true },
    });
    if (!tenancy) throw new Error("The selected rental was not found.");
  }

  const validated = await validatePrivateDocument(input.file);
  const id = randomUUID();
  const storageKey = createPersonDocumentKey(
    input.personId,
    id,
    validated.extension,
  );
  const manifest = await readManifest(input.personId);
  const stored: StoredPersonDocument = {
    id,
    type: input.type,
    title,
    note: input.note?.trim() || null,
    fileName: input.file.name || `${title}.${validated.extension}`,
    contentType: validated.mime,
    uploadedAt: new Date().toISOString(),
    tenancyId: input.tenancyId || null,
    storageKey,
  };

  await localPrivateStorage.put(storageKey, validated.bytes);
  try {
    await writeManifest(input.personId, {
      version: 1,
      documents: [stored, ...manifest.documents],
    });
  } catch (error) {
    await localPrivateStorage.delete(storageKey);
    throw error;
  }
  return { id };
}

export async function replacePersonDocument(input: {
  personId: string;
  documentId: string;
  file: File;
}) {
  await ensurePerson(input.personId, true);
  const manifest = await readManifest(input.personId);
  const index = manifest.documents.findIndex((item) => item.id === input.documentId);
  if (index < 0) throw new Error("The selected document was not found.");
  const previous = manifest.documents[index];
  const validated = await validatePrivateDocument(input.file);
  const storageKey = createPersonDocumentKey(
    input.personId,
    previous.id,
    validated.extension,
  );
  const next: StoredPersonDocument = {
    ...previous,
    fileName: input.file.name || previous.fileName,
    contentType: validated.mime,
    uploadedAt: new Date().toISOString(),
    storageKey,
  };

  await localPrivateStorage.put(storageKey, validated.bytes);
  try {
    manifest.documents[index] = next;
    await writeManifest(input.personId, manifest);
  } catch (error) {
    await localPrivateStorage.delete(storageKey);
    throw error;
  }
  if (previous.storageKey !== storageKey) {
    try {
      await localPrivateStorage.delete(previous.storageKey);
    } catch {
      console.error("Could not remove replaced private document object.");
    }
  }
}

export async function deletePersonDocument(personId: string, documentId: string) {
  await ensurePerson(personId, true);
  const manifest = await readManifest(personId);
  const document = manifest.documents.find((item) => item.id === documentId);
  if (!document) throw new Error("The selected document was not found.");
  await writeManifest(personId, {
    version: 1,
    documents: manifest.documents.filter((item) => item.id !== documentId),
  });
  try {
    await localPrivateStorage.delete(document.storageKey);
  } catch {
    console.error("Could not remove deleted private document object.");
  }
}

export async function getPersonDocument(personId: string, documentId: string) {
  await ensurePerson(personId);
  const manifest = await readManifest(personId);
  const document = manifest.documents.find((item) => item.id === documentId);
  if (!document) return null;
  return {
    ...document,
    bytes: await localPrivateStorage.get(document.storageKey),
  };
}
