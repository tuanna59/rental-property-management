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

export async function getMeterReadingPhoto(
  meterId: string,
  readingId: string,
  index = 0,
) {
  const reading = await prisma.meterReading.findFirst({
    where: { id: readingId, meterId },
    select: {
      photoStorageKey: true,
      evidencePhotos: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { storageKey: true },
      },
    },
  });
  if (!reading) return null;

  const keys = [
    ...new Set(
      [
        reading.photoStorageKey,
        ...reading.evidencePhotos.map((photo) => photo.storageKey),
      ].filter((key): key is string => Boolean(key)),
    ),
  ];
  const key = keys[index];
  if (!key) return null;

  return {
    key,
    bytes: await localPrivateStorage.get(key),
  };
}
