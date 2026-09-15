export const frames = [
  { id: "cherry", name: "Cherry afterglow", note: "Soft flash & handwritten details" },
  { id: "lilac", name: "Lilac hello", note: "Calm tones for an easy catch-up" },
  { id: "midnight", name: "Midnight postcard", note: "A little more dramatic" },
] as const;

export type Frame = (typeof frames)[number];

export const modes = [
  { id: "solo", eyebrow: "Just you", title: "Solo photo box", detail: "Take four photos when the mood is right." },
  { id: "together", eyebrow: "Two screens", title: "Make one together", detail: "Share a private room and strike each pose together, from anywhere." },
] as const;

export type Mode = (typeof modes)[number];
