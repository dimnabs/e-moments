import { randomUUID } from "node:crypto";

import type { StoredObject } from "../../solo-photo-strips/domain/types";
import type { ObjectStorageRepository } from "../../solo-photo-strips/repositories/object-storage-repository";
import { composeSharedPhotoStrip } from "../composer/compose-shared-photo-strip";
import type { SharedRoomCompositionInput } from "../domain/types";

function extensionFor(contentType: string) {
  return contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
}

export async function createSharedPhotoStrip(input: SharedRoomCompositionInput, storage: ObjectStorageRepository) {
  const strip = await composeSharedPhotoStrip(input.participants, input.frameId);
  const outputKey = `shared-photo-strips/${input.storageId}/${randomUUID()}/e-moment-photo-strip.png`;
  const originals: StoredObject[] = input.participants.flatMap((participant, participantIndex) => participant.photos.map((photo, slot) => ({
    body: photo.buffer,
    contentType: photo.contentType,
    key: `shared-photo-strips/${input.storageId}/originals/${participantIndex + 1}-${participant.id}/${slot + 1}.${extensionFor(photo.contentType)}`,
  })));
  await storage.storePrivateObjects([...originals, { body: strip, contentType: "image/png", key: outputKey }]);
  return storage.createDownloadUrl(outputKey);
}
