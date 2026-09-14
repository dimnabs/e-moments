import { NextResponse } from "next/server";

import { InvalidPhotoStripRequestError, StorageConfigurationError } from "@/server/solo-photo-strips/domain/errors";
import { S3ObjectStorageRepository } from "@/server/solo-photo-strips/repositories/s3-object-storage-repository";
import { createSoloPhotoStrip } from "@/server/solo-photo-strips/services/create-solo-photo-strip";
import { validateCreateSoloPhotoStrip } from "@/server/solo-photo-strips/validation/validate-create-solo-photo-strip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Send the photos as multipart form data.", 400, "INVALID_MULTIPART_FORM_DATA");
  }

  try {
    const input = await validateCreateSoloPhotoStrip(formData);
    const photoStrip = await createSoloPhotoStrip(input, new S3ObjectStorageRepository());
    return NextResponse.json(photoStrip, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidPhotoStripRequestError) {
      return errorResponse(error.message, 400, error.code);
    }
    if (error instanceof StorageConfigurationError) {
      console.error("Photo strip storage is not configured.", error.message);
      return errorResponse("Photo storage is not configured yet.", 500, "STORAGE_CONFIGURATION_ERROR");
    }
    console.error("Unable to create solo photo strip.", error);
    return errorResponse("We couldn’t create your photo strip. Please try again.", 502, "PHOTO_STRIP_PROCESSING_FAILED");
  }
}
