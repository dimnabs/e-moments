export type PhotoStripValidationCode = "INVALID_FRAME_ID" | "INVALID_PHOTO_COUNT" | "INVALID_PHOTO";

export class InvalidPhotoStripRequestError extends Error {
  constructor(message: string, readonly code: PhotoStripValidationCode) {
    super(message);
  }
}

export class StorageConfigurationError extends Error {}
