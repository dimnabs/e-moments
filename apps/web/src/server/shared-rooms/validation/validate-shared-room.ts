import { frameIds } from "../../solo-photo-strips/domain/constants";
import type { FrameId, PhotoInput } from "../../solo-photo-strips/domain/types";
import { InvalidPhotoStripRequestError } from "../../solo-photo-strips/domain/errors";
import { validatePhotoFile } from "../../solo-photo-strips/validation/validate-create-solo-photo-strip";
import { SharedRoomError } from "../domain/errors";

export function validateDisplayName(value: unknown) {
  if (value === undefined) return "Guest";
  if (typeof value !== "string") throw new SharedRoomError("displayName must be a short name.", "INVALID_ROOM_REQUEST", 400);
  const displayName = value.trim().replace(/\s+/g, " ");
  if (!displayName || displayName.length > 40) throw new SharedRoomError("displayName must be between 1 and 40 characters.", "INVALID_ROOM_REQUEST", 400);
  return displayName;
}

export function validateSharedFrameId(value: unknown): FrameId {
  if (typeof value !== "string" || !frameIds.includes(value as FrameId)) {
    throw new SharedRoomError("frameId must be cherry, lilac, or midnight.", "INVALID_ROOM_REQUEST", 400);
  }
  return value as FrameId;
}

export function validateBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new SharedRoomError(`${field} must be true or false.`, "INVALID_ROOM_REQUEST", 400);
  return value;
}

export function validateCaptureId(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(value)) {
    throw new SharedRoomError("A valid captureId is required.", "INVALID_ROOM_REQUEST", 400);
  }
  return value;
}

export async function validateSharedPhoto(file: FormDataEntryValue | null): Promise<PhotoInput> {
  if (!(file instanceof File)) throw new SharedRoomError("Submit one image file using the photo field.", "INVALID_ROOM_REQUEST", 400);
  try {
    return await validatePhotoFile(file, 0);
  } catch (error) {
    if (error instanceof InvalidPhotoStripRequestError) throw new SharedRoomError(error.message, "INVALID_ROOM_REQUEST", 400);
    throw error;
  }
}
