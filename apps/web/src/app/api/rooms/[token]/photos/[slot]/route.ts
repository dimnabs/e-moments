import { S3ObjectStorageRepository } from "@/server/solo-photo-strips/repositories/s3-object-storage-repository";
import { SHARED_ROOM } from "@/server/shared-rooms/domain/constants";
import { SharedRoomError } from "@/server/shared-rooms/domain/errors";
import { cappedMultipartFormData, credentialFrom, errorResponse, roomResponse } from "@/server/shared-rooms/http";
import { createSharedPhotoStrip } from "@/server/shared-rooms/services/create-shared-photo-strip";
import { sharedRoomStore } from "@/server/shared-rooms/services/in-memory-room-store";
import { enforceRateLimit } from "@/server/shared-rooms/services/rate-limiter";
import { validateCaptureId, validateSharedPhoto } from "@/server/shared-rooms/validation/validate-shared-room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slot: string; token: string }> };

export async function POST(request: Request, context: Context) {
  let token: string | undefined;
  let credential: string | undefined;
  let captureId: string | undefined;
  try {
    const params = await context.params;
    token = params.token;
    const slot = Number(params.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= SHARED_ROOM.captureCount) {
      throw new SharedRoomError("The photo slot must be between 0 and 3.", "INVALID_ROOM_REQUEST", 400);
    }
    credential = credentialFrom(request);
    enforceRateLimit(`room-upload:${token}:${credential}`, SHARED_ROOM.uploadRateLimit);
    // Authorize before reading multipart bytes or invoking Sharp.
    sharedRoomStore.snapshot(token, credential);
    const formData = await cappedMultipartFormData(request);
    captureId = validateCaptureId(formData.get("captureId"));
    const photo = await validateSharedPhoto(formData.get("photo"));
    const accepted = sharedRoomStore.addPhoto(token, credential, captureId, slot, photo);
    if (accepted.composition) {
      try {
        const result = await createSharedPhotoStrip(accepted.composition, new S3ObjectStorageRepository());
        sharedRoomStore.complete(token, captureId, result);
      } catch (error) {
        sharedRoomStore.fail(token, captureId);
        throw error;
      }
    }
    return roomResponse({ room: sharedRoomStore.snapshot(token, credential) });
  } catch (error) {
    return errorResponse(error);
  }
}
