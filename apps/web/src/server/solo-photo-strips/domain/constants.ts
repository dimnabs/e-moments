export const SOLO_PHOTO_STRIP = {
  width: 1200,
  height: 1950,
  photoPadding: 70,
  photoTop: 155,
  photoHeight: 390,
  photoGap: 24,
  photoCount: 4,
  maxFileBytes: 6 * 1024 * 1024,
  minImageDimension: 320,
  maxImageDimension: 12_000,
  maxInputPixels: 40_000_000,
  signedUrlTtlSeconds: 60 * 60,
} as const;

export const frameIds = ["cherry", "lilac", "midnight"] as const;

export const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
