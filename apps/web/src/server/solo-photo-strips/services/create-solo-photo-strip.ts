import { randomUUID } from "node:crypto";

import { composePhotoStrip } from "../composer/sharp-photo-strip-composer";
import type { DownloadablePhotoStrip, StoredObject } from "../domain/types";
import type { ObjectStorageRepository } from "../repositories/object-storage-repository";
import type { CreateSoloPhotoStripInput } from "../validation/validate-create-solo-photo-strip";

function extensionForMimeType(mimeType: CreateSoloPhotoStripInput["photos"][number]["contentType"]) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
}

export async function createSoloPhotoStrip(input: CreateSoloPhotoStripInput, storage: ObjectStorageRepository): Promise<DownloadablePhotoStrip> {
  const strip = await composePhotoStrip(input.photos, input.frameId);
  const stripId = randomUUID();
  const originalPrefix = `solo-photo-strips/${stripId}/originals`;
  const outputKey = `solo-photo-strips/${stripId}/e-moment-photo-strip.png`;
  const originals: StoredObject[] = input.photos.map((photo, index) => ({
    key: `${originalPrefix}/${index + 1}.${extensionForMimeType(photo.contentType)}`,
    body: photo.buffer,
    contentType: photo.contentType,
  }));

  await storage.storePrivateObjects([...originals, { key: outputKey, body: strip, contentType: "image/png" }]);
  return storage.createDownloadUrl(outputKey);
}
