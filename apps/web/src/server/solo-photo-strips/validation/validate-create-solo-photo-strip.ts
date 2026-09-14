import sharp, { type Metadata } from "sharp";

import { allowedImageMimeTypes, frameIds, SOLO_PHOTO_STRIP } from "../domain/constants";
import { InvalidPhotoStripRequestError } from "../domain/errors";
import type { AllowedImageMimeType, FrameId, PhotoInput } from "../domain/types";

export type CreateSoloPhotoStripInput = {
  frameId: FrameId;
  photos: PhotoInput[];
};

export function validateFrameId(value: FormDataEntryValue | null): FrameId {
  if (typeof value !== "string" || !frameIds.includes(value as FrameId)) {
    throw new InvalidPhotoStripRequestError("frameId must be cherry, lilac, or midnight.", "INVALID_FRAME_ID");
  }

  return value as FrameId;
}

export function validatePhotoCount(photos: FormDataEntryValue[]): File[] {
  if (photos.length !== SOLO_PHOTO_STRIP.photoCount || photos.some((photo) => !(photo instanceof File))) {
    throw new InvalidPhotoStripRequestError("Submit exactly four image files using the photos field.", "INVALID_PHOTO_COUNT");
  }

  return photos as File[];
}

function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return allowedImageMimeTypes.includes(value as AllowedImageMimeType);
}

function expectedSharpFormat(mimeType: AllowedImageMimeType) {
  return mimeType === "image/jpeg" ? "jpeg" : mimeType.slice("image/".length);
}

async function validatePhoto(file: File, index: number): Promise<PhotoInput> {
  if (!isAllowedImageMimeType(file.type)) {
    throw new InvalidPhotoStripRequestError(`Photo ${index + 1} must be a JPEG, PNG, or WebP image.`, "INVALID_PHOTO");
  }
  if (file.size === 0 || file.size > SOLO_PHOTO_STRIP.maxFileBytes) {
    throw new InvalidPhotoStripRequestError(`Photo ${index + 1} must be no larger than 6 MB.`, "INVALID_PHOTO");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: SOLO_PHOTO_STRIP.maxInputPixels, failOn: "error" }).metadata();
  } catch {
    throw new InvalidPhotoStripRequestError(`Photo ${index + 1} is not a valid image file.`, "INVALID_PHOTO");
  }

  if (!metadata.width || !metadata.height || metadata.format !== expectedSharpFormat(file.type)) {
    throw new InvalidPhotoStripRequestError(`Photo ${index + 1} is not a supported image file.`, "INVALID_PHOTO");
  }
  if (metadata.width < SOLO_PHOTO_STRIP.minImageDimension || metadata.height < SOLO_PHOTO_STRIP.minImageDimension || metadata.width > SOLO_PHOTO_STRIP.maxImageDimension || metadata.height > SOLO_PHOTO_STRIP.maxImageDimension) {
    throw new InvalidPhotoStripRequestError(`Photo ${index + 1} must be between ${SOLO_PHOTO_STRIP.minImageDimension} and ${SOLO_PHOTO_STRIP.maxImageDimension} pixels on each side.`, "INVALID_PHOTO");
  }

  return { buffer, contentType: file.type };
}

export async function validateCreateSoloPhotoStrip(formData: FormData): Promise<CreateSoloPhotoStripInput> {
  const frameId = validateFrameId(formData.get("frameId"));
  const files = validatePhotoCount(formData.getAll("photos"));
  const photos = await Promise.all(files.map(validatePhoto));

  return { frameId, photos };
}
