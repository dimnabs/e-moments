import type { FrameId } from "./types";

type FramePalette = {
  background: string;
  foreground: string;
};

export const framePalettes: Record<FrameId, FramePalette> = {
  cherry: { background: "#f9d7d2", foreground: "#6e2534" },
  lilac: { background: "#e0d5f1", foreground: "#3c3154" },
  midnight: { background: "#332c45", foreground: "#f6e8d8" },
};
