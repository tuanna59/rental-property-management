import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  localPrivateStorage,
  validatePrivateImage,
} from "@/modules/people/server/private-storage";

export async function saveMeterPhoto(meterId: string, file?: File) {
  if (!file || !file.size) return null;
  const image = await validatePrivateImage(file);
  const key = `meters/${meterId}/${randomUUID()}.${image.extension}`;
  await localPrivateStorage.put(key, image.bytes);
  return key;
}

export async function getMeterReadingPhoto(meterId: string, readingId: string) {
  const reading = await prisma.meterReading.findFirst({
    where: { id: readingId, meterId },
    select: {
      photoStorageKey: true,
      evidencePhotos: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { storageKey: true },
      },
    },
  });
  const key = reading?.evidencePhotos[0]?.storageKey ?? reading?.photoStorageKey;
  if (!key) return null;
  return {
    key,
    bytes: await localPrivateStorage.get(key),
  };
}
