import type { allowedImageMimeTypes, frameIds } from "./constants";

export type FrameId = (typeof frameIds)[number];
export type AllowedImageMimeType = (typeof allowedImageMimeTypes)[number];

export type PhotoInput = {
  buffer: Buffer;
  contentType: AllowedImageMimeType;
};

export type DownloadablePhotoStrip = {
  downloadUrl: string;
  expiresAt: string;
};

export type StoredObject = {
  body: Buffer;
  contentType: string;
  key: string;
};
