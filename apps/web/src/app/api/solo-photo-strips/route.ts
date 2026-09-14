import { randomUUID } from "node:crypto";

import sharp, { type Metadata } from "sharp";
import { NextResponse } from "next/server";

import { allowedImageMimeTypes, frameIds, SOLO_PHOTO_STRIP, type AllowedImageMimeType, type FrameId } from "@/lib/solo-photo-processing/constants";
import { composeSoloPhotoStrip } from "@/lib/solo-photo-processing/strip";
import { createPrivateDownloadUrl, uploadPrivateObject } from "@/lib/solo-photo-processing/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class RequestValidationError extends Error {}

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isFrameId(value: string): value is FrameId {
  return frameIds.includes(value as FrameId);
}

function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return allowedImageMimeTypes.includes(value as AllowedImageMimeType);
}

function extensionForMimeType(mimeType: AllowedImageMimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
}

function expectedSharpFormat(mimeType: AllowedImageMimeType) {
  return mimeType === "image/jpeg" ? "jpeg" : mimeType.slice("image/".length);
}

async function validatePhoto(file: File, index: number) {
  if (!isAllowedImageMimeType(file.type)) {
    throw new RequestValidationError(`Photo ${index + 1} must be a JPEG, PNG, or WebP image.`);
  }
  if (file.size === 0 || file.size > SOLO_PHOTO_STRIP.maxFileBytes) {
    throw new RequestValidationError(`Photo ${index + 1} must be no larger than 6 MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: SOLO_PHOTO_STRIP.maxInputPixels, failOn: "error" }).metadata();
  } catch {
    throw new RequestValidationError(`Photo ${index + 1} is not a valid image file.`);
  }

  if (!metadata.width || !metadata.height || metadata.format !== expectedSharpFormat(file.type)) {
    throw new RequestValidationError(`Photo ${index + 1} is not a supported image file.`);
  }
  if (metadata.width < SOLO_PHOTO_STRIP.minImageDimension || metadata.height < SOLO_PHOTO_STRIP.minImageDimension || metadata.width > SOLO_PHOTO_STRIP.maxImageDimension || metadata.height > SOLO_PHOTO_STRIP.maxImageDimension) {
    throw new RequestValidationError(`Photo ${index + 1} must be between ${SOLO_PHOTO_STRIP.minImageDimension} and ${SOLO_PHOTO_STRIP.maxImageDimension} pixels on each side.`);
  }

  return { buffer, contentType: file.type };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Send the photos as multipart form data.", 400, "INVALID_MULTIPART_FORM_DATA");
  }

  const frameId = formData.get("frameId");
  if (typeof frameId !== "string" || !isFrameId(frameId)) {
    return errorResponse("frameId must be cherry, lilac, or midnight.", 400, "INVALID_FRAME_ID");
  }

  const submittedPhotos = formData.getAll("photos");
  if (submittedPhotos.length !== SOLO_PHOTO_STRIP.photoCount || submittedPhotos.some((photo) => !(photo instanceof File))) {
    return errorResponse("Submit exactly four image files using the photos field.", 400, "INVALID_PHOTO_COUNT");
  }

  try {
    const photos = await Promise.all(submittedPhotos.map((photo, index) => validatePhoto(photo as File, index)));
    const strip = await composeSoloPhotoStrip(photos, frameId);
    const stripId = randomUUID();
    const originalPrefix = `solo-photo-strips/${stripId}/originals`;
    const outputKey = `solo-photo-strips/${stripId}/e-moment-photo-strip.png`;

    await Promise.all([
      ...photos.map((photo, index) => uploadPrivateObject(`${originalPrefix}/${index + 1}.${extensionForMimeType(photo.contentType)}`, photo.buffer, photo.contentType)),
      uploadPrivateObject(outputKey, strip, "image/png"),
    ]);

    return NextResponse.json(await createPrivateDownloadUrl(outputKey), { status: 201 });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(error.message, 400, "INVALID_PHOTO");
    }
    if (error instanceof Error && error.message.startsWith("Missing required environment variable:")) {
      console.error("Photo strip storage is not configured.", error.message);
      return errorResponse("Photo storage is not configured yet.", 500, "STORAGE_CONFIGURATION_ERROR");
    }
    console.error("Unable to create solo photo strip.", error);
    return errorResponse("We couldn’t create your photo strip. Please try again.", 502, "PHOTO_STRIP_PROCESSING_FAILED");
  }
}
