import sharp from "sharp";

import { SOLO_PHOTO_STRIP } from "../domain/constants";
import { framePalettes } from "../domain/frame-palettes";
import type { FrameId, PhotoInput } from "../domain/types";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

function textLayer(text: string, y: number, fontSize: number, color: string, fontFamily: string, extras = "") {
  return Buffer.from(`<svg width="${SOLO_PHOTO_STRIP.width}" height="${SOLO_PHOTO_STRIP.height}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="${y}" text-anchor="middle" fill="${color}" font-family="${fontFamily}" font-size="${fontSize}" ${extras}>${escapeXml(text)}</text></svg>`);
}

/** Creates the server-owned, high-resolution version of the browser photo strip. */
export async function composePhotoStrip(photos: PhotoInput[], frameId: FrameId) {
  const palette = framePalettes[frameId];
  const photoWidth = SOLO_PHOTO_STRIP.width - SOLO_PHOTO_STRIP.photoPadding * 2;
  const renderedPhotos = await Promise.all(photos.map(({ buffer }) => sharp(buffer, { limitInputPixels: SOLO_PHOTO_STRIP.maxInputPixels })
    .rotate()
    .resize({ width: photoWidth, height: SOLO_PHOTO_STRIP.photoHeight, fit: "cover", position: "centre" })
    .png()
    .toBuffer()));

  return sharp({
    create: { width: SOLO_PHOTO_STRIP.width, height: SOLO_PHOTO_STRIP.height, channels: 4, background: palette.background },
  })
    .composite([
      ...renderedPhotos.map((input, index) => ({ input, left: SOLO_PHOTO_STRIP.photoPadding, top: SOLO_PHOTO_STRIP.photoTop + index * (SOLO_PHOTO_STRIP.photoHeight + SOLO_PHOTO_STRIP.photoGap) })),
      { input: textLayer("e-moment", 105, 66, palette.foreground, "Georgia, serif", 'font-style="italic"') },
      { input: textLayer("A LITTLE MOMENT, YOURS", 1880, 28, palette.foreground, "Arial, sans-serif", 'letter-spacing="3"') },
    ])
    .png()
    .toBuffer();
}
