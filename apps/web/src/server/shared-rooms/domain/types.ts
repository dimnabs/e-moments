import type { DownloadablePhotoStrip, FrameId, PhotoInput } from "../../solo-photo-strips/domain/types";

export type RoomStatus = "lobby" | "capturing" | "processing" | "complete" | "failed";
export type ParticipantRole = "host" | "guest";

export type SharedRoomParticipant = {
  displayName: string;
  id: string;
  presence: "offline" | "online";
  ready: boolean;
  role: ParticipantRole;
  uploadedSlots: number[];
};

export type SharedRoomSnapshot = {
  captureAt?: string[];
  captureId?: string;
  expiresAt: string;
  frameId: FrameId;
  participants: SharedRoomParticipant[];
  revision: number;
  result?: DownloadablePhotoStrip;
  startedAt?: string;
  status: RoomStatus;
  token: string;
};

export type ParticipantCredential = {
  credential: string;
  id: string;
  role: ParticipantRole;
};

export type SharedRoomCreation = {
  inviteUrl: string;
  participant: ParticipantCredential;
  room: SharedRoomSnapshot;
};

export type SharedRoomCompositionInput = {
  captureId: string;
  frameId: FrameId;
  participants: Array<{ id: string; photos: PhotoInput[] }>;
  storageId: string;
  token: string;
};
