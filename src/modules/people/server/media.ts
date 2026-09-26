import { prisma } from "@/lib/prisma";

import {
  createPersonMediaKey,
  localPrivateStorage,
  type PersonMediaKind,
  validatePrivateImage,
} from "./private-storage";

const fieldByKind = {
  avatar: "avatarStorageKey",
  "citizen-front": "citizenIdFrontKey",
  "citizen-back": "citizenIdBackKey",
} as const;

export async function replacePersonMedia(
  personId: string,
  kind: PersonMediaKind,
  file: File,
) {
  const person = await prisma.person.findFirst({
    where: { id: personId, archivedAt: null },
    select: {
      id: true,
      avatarStorageKey: true,
      citizenIdFrontKey: true,
      citizenIdBackKey: true,
    },
  });
  if (!person) throw new Error("The selected person was not found.");

  const image = await validatePrivateImage(file);
  const storageKey = createPersonMediaKey(person.id, kind, image.extension);
  const field = fieldByKind[kind];
  const previousKey = person[field];
  await localPrivateStorage.put(storageKey, image.bytes);
  try {
    await prisma.person.update({
      where: { id: person.id },
      data: { [field]: storageKey },
    });
  } catch (error) {
    await localPrivateStorage.delete(storageKey);
    throw error;
  }
  if (previousKey) {
    try {
      await localPrivateStorage.delete(previousKey);
    } catch {
      // The new object is already durable and referenced. Cleanup is best-effort.
      console.error("Could not remove replaced private media object.");
    }
  }
}

export async function getPersonMedia(personId: string, kind: PersonMediaKind) {
  const field = fieldByKind[kind];
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      avatarStorageKey: true,
      citizenIdFrontKey: true,
      citizenIdBackKey: true,
    },
  });
  const key = person?.[field];
  if (!key) return null;
  return { key, bytes: await localPrivateStorage.get(key) };
}
