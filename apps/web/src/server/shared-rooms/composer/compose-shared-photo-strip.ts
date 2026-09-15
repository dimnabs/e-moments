import sharp from "sharp";

import { SOLO_PHOTO_STRIP } from "../../solo-photo-strips/domain/constants";
import { composePhotoStrip } from "../../solo-photo-strips/composer/sharp-photo-strip-composer";
import type { FrameId, PhotoInput } from "../../solo-photo-strips/domain/types";

/** Pairs matching capture slots horizontally, then uses the existing four-row strip renderer. */
export async function composeSharedPhotoStrip(participants: Array<{ photos: PhotoInput[] }>, frameId: FrameId) {
  if (participants.length !== 2 || participants.some((participant) => participant.photos.length !== SOLO_PHOTO_STRIP.photoCount)) {
    throw new Error("A shared strip requires four photos from each of two participants.");
  }

  const photoWidth = SOLO_PHOTO_STRIP.width - SOLO_PHOTO_STRIP.photoPadding * 2;
  const gap = 18;
  const halfWidth = Math.floor((photoWidth - gap) / 2);
  const pairedRows = await Promise.all(Array.from({ length: SOLO_PHOTO_STRIP.photoCount }, async (_, slot) => {
    const [left, right] = await Promise.all(participants.map(async (participant) => sharp(participant.photos[slot].buffer, { limitInputPixels: SOLO_PHOTO_STRIP.maxInputPixels })
      .rotate()
      .resize({ width: halfWidth, height: SOLO_PHOTO_STRIP.photoHeight, fit: "cover", position: "centre" })
      .png()
      .toBuffer()));
    const row = await sharp({
      create: { width: photoWidth, height: SOLO_PHOTO_STRIP.photoHeight, channels: 4, background: "#f4ede8" },
    })
      .composite([{ input: left, left: 0, top: 0 }, { input: right, left: halfWidth + gap, top: 0 }])
      .png()
      .toBuffer();
    return { buffer: row, contentType: "image/png" as const };
  }));

  return composePhotoStrip(pairedRows, frameId);
}
