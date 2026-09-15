import { randomBytes, randomUUID } from "node:crypto";

import type { DownloadablePhotoStrip, FrameId, PhotoInput } from "../../solo-photo-strips/domain/types";
import { SHARED_ROOM } from "../domain/constants";
import { SharedRoomError } from "../domain/errors";
import type { ParticipantRole, RoomStatus, SharedRoomCompositionInput, SharedRoomCreation, SharedRoomSnapshot } from "../domain/types";

type ParticipantRecord = {
  credential: string;
  displayName: string;
  id: string;
  presenceConnections: number;
  ready: boolean;
  role: ParticipantRole;
  uploads: Array<PhotoInput | undefined>;
};

type RoomRecord = {
  captureAt?: number[];
  captureId?: string;
  createdAt: number;
  expiresAt: number;
  frameId: FrameId;
  idempotentJoins: Map<string, { credential: string; createdAt: number; participantId: string }>;
  lastActivityAt: number;
  participants: ParticipantRecord[];
  result?: DownloadablePhotoStrip;
  revision: number;
  startedAt?: number;
  status: RoomStatus;
  storageId: string;
  subscribers: Set<(snapshot: SharedRoomSnapshot) => void>;
  timeout?: ReturnType<typeof setTimeout>;
  token: string;
};

type SharedRoomState = { rooms: Map<string, RoomRecord> };
const stateKey = "__eMomentSharedRoomState";
const globalState = globalThis as typeof globalThis & { [stateKey]?: SharedRoomState };
const state = globalState[stateKey] ?? (globalState[stateKey] = { rooms: new Map<string, RoomRecord>() });
const rooms = state.rooms;

function opaqueToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

function date(milliseconds: number) {
  return new Date(milliseconds).toISOString();
}

function publicRoom(room: RoomRecord): SharedRoomSnapshot {
  return {
    ...(room.captureAt ? { captureAt: room.captureAt.map(date) } : {}),
    ...(room.captureId ? { captureId: room.captureId } : {}),
    expiresAt: date(room.expiresAt),
    frameId: room.frameId,
    participants: room.participants.map((participant) => ({
      displayName: participant.displayName,
      id: participant.id,
      presence: participant.presenceConnections > 0 ? "online" : "offline",
      ready: participant.ready,
      role: participant.role,
      uploadedSlots: participant.uploads.flatMap((upload, index) => upload ? [index] : []),
    })),
    ...(room.result ? { result: room.result } : {}),
    revision: room.revision,
    ...(room.startedAt ? { startedAt: date(room.startedAt) } : {}),
    status: room.status,
    token: room.token,
  };
}

function notify(room: RoomRecord) {
  room.revision += 1;
  const snapshot = publicRoom(room);
  for (const subscriber of room.subscribers) subscriber(snapshot);
}

function clearRoomMedia(room: RoomRecord) {
  for (const participant of room.participants) participant.uploads = [];
}

function clearCaptureTimeout(room: RoomRecord) {
  if (room.timeout) clearTimeout(room.timeout);
  room.timeout = undefined;
}

function expireCapture(room: RoomRecord, captureId: string) {
  if (room.captureId !== captureId || !["capturing", "processing"].includes(room.status)) return;
  room.status = "failed";
  clearRoomMedia(room);
  notify(room);
}

function expirationFor(room: RoomRecord, now: number) {
  if (now >= room.expiresAt) return true;
  return room.status === "lobby" && now - room.lastActivityAt >= SHARED_ROOM.lobbyInactivityMilliseconds;
}

function expire(room: RoomRecord) {
  room.status = "failed";
  room.expiresAt = Date.now();
  clearCaptureTimeout(room);
  clearRoomMedia(room);
  notify(room);
}

function getRoom(token: string) {
  const room = rooms.get(token);
  if (!room) throw new SharedRoomError("This room doesn’t exist or its invite is no longer valid.", "ROOM_NOT_FOUND", 404);
  if (expirationFor(room, Date.now())) {
    expire(room);
    rooms.delete(token);
    throw new SharedRoomError("This room has expired. Please create a new invite.", "ROOM_EXPIRED", 404);
  }
  return room;
}

function participantFor(room: RoomRecord, credential: string) {
  const participant = room.participants.find((candidate) => candidate.credential === credential);
  if (!participant) throw new SharedRoomError("Your room access has expired. Rejoin with a new invite.", "INVALID_PARTICIPANT_CREDENTIAL", 401);
  return participant;
}

function assertLobby(room: RoomRecord) {
  if (room.status !== "lobby") throw new SharedRoomError("This invite is no longer accepting changes.", "ROOM_STATE_CONFLICT", 409);
}

function prune(now = Date.now()) {
  for (const [token, room] of rooms) {
    if (expirationFor(room, now)) {
      clearCaptureTimeout(room);
      clearRoomMedia(room);
      rooms.delete(token);
    }
  }
}

export class InMemoryRoomStore {
  create(frameId: FrameId, displayName: string): SharedRoomCreation {
    prune();
    if (rooms.size >= SHARED_ROOM.maximumRooms) {
      throw new SharedRoomError("All photo rooms are busy. Please try again shortly.", "ROOM_CAPACITY_REACHED", 503);
    }
    const now = Date.now();
    const token = opaqueToken();
    const host: ParticipantRecord = { credential: opaqueToken(32), displayName, id: randomUUID(), presenceConnections: 0, ready: false, role: "host", uploads: [] };
    const room: RoomRecord = {
      createdAt: now,
      expiresAt: now + SHARED_ROOM.inviteLifetimeMilliseconds,
      frameId,
      idempotentJoins: new Map(),
      lastActivityAt: now,
      participants: [host],
      revision: 0,
      status: "lobby",
      storageId: randomUUID(),
      subscribers: new Set(),
      token,
    };
    rooms.set(token, room);
    return { inviteUrl: `/room/${token}`, participant: { credential: host.credential, id: host.id, role: host.role }, room: publicRoom(room) };
  }

  join(token: string, displayName: string, idempotencyKey?: string): SharedRoomCreation {
    const room = getRoom(token);
    assertLobby(room);
    if (idempotencyKey) {
      const existing = room.idempotentJoins.get(idempotencyKey);
      if (existing && Date.now() - existing.createdAt < 10 * 60 * 1_000) {
        const participant = room.participants.find((candidate) => candidate.id === existing.participantId);
        if (participant) return { inviteUrl: `/room/${token}`, participant: { credential: existing.credential, id: participant.id, role: participant.role }, room: publicRoom(room) };
      }
    }
    if (room.participants.length >= 2) throw new SharedRoomError("This invite has already been used.", "ROOM_FULL", 409);
    const guest: ParticipantRecord = { credential: opaqueToken(32), displayName, id: randomUUID(), presenceConnections: 0, ready: false, role: "guest", uploads: [] };
    room.participants.push(guest);
    room.lastActivityAt = Date.now();
    if (idempotencyKey) room.idempotentJoins.set(idempotencyKey, { credential: guest.credential, createdAt: Date.now(), participantId: guest.id });
    notify(room);
    return { inviteUrl: `/room/${token}`, participant: { credential: guest.credential, id: guest.id, role: guest.role }, room: publicRoom(room) };
  }

  snapshot(token: string, credential: string) {
    const room = getRoom(token);
    participantFor(room, credential);
    room.lastActivityAt = Date.now();
    return publicRoom(room);
  }

  updateLobby(token: string, credential: string, changes: { frameId?: FrameId; ready?: boolean }) {
    const room = getRoom(token);
    const participant = participantFor(room, credential);
    assertLobby(room);
    if (changes.frameId) {
      if (participant.role !== "host") throw new SharedRoomError("Only the host can change the frame.", "HOST_REQUIRED", 403);
      room.frameId = changes.frameId;
      for (const candidate of room.participants) candidate.ready = false;
    }
    if (changes.ready !== undefined) participant.ready = changes.ready;
    room.lastActivityAt = Date.now();
    notify(room);
    return publicRoom(room);
  }

  start(token: string, credential: string) {
    const room = getRoom(token);
    const participant = participantFor(room, credential);
    assertLobby(room);
    if (participant.role !== "host") throw new SharedRoomError("Only the host can start the photo sequence.", "HOST_REQUIRED", 403);
    if (room.participants.length !== 2 || room.participants.some((candidate) => !candidate.ready || candidate.presenceConnections === 0)) {
      throw new SharedRoomError("Both participants must be online and ready before the countdown can start.", "ROOM_STATE_CONFLICT", 409);
    }
    const startedAt = Date.now();
    room.captureId = opaqueToken(24);
    room.captureAt = Array.from({ length: SHARED_ROOM.captureCount }, (_, index) => startedAt + SHARED_ROOM.captureLeadMilliseconds + index * SHARED_ROOM.captureIntervalMilliseconds);
    room.startedAt = startedAt;
    room.status = "capturing";
    room.lastActivityAt = startedAt;
    const captureDeadline = room.captureAt.at(-1)! + SHARED_ROOM.captureUploadGraceMilliseconds;
    room.timeout = setTimeout(() => expireCapture(room, room.captureId!), Math.max(1, captureDeadline - Date.now()));
    room.timeout.unref?.();
    notify(room);
    return publicRoom(room);
  }

  addPhoto(token: string, credential: string, captureId: string, slot: number, photo: PhotoInput) {
    const room = getRoom(token);
    const participant = participantFor(room, credential);
    if (!Number.isInteger(slot) || slot < 0 || slot >= SHARED_ROOM.captureCount) {
      throw new SharedRoomError("The photo slot must be between 0 and 3.", "INVALID_ROOM_REQUEST", 400);
    }
    if (room.captureId !== captureId) {
      throw new SharedRoomError("This capture sequence is no longer active.", "ROOM_STATE_CONFLICT", 409);
    }
    if (room.status === "processing" || room.status === "complete") return { composition: undefined, room: publicRoom(room) };
    if (room.status !== "capturing" || !room.captureAt) throw new SharedRoomError("This capture sequence is no longer active.", "ROOM_STATE_CONFLICT", 409);
    const captureAt = room.captureAt[slot];
    const now = Date.now();
    if (now < captureAt - 2_000 || now > captureAt + SHARED_ROOM.captureUploadGraceMilliseconds) {
      throw new SharedRoomError("This photo arrived outside its capture window. Start a new room to try again.", "CAPTURE_WINDOW_CLOSED", 409);
    }
    const existing = participant.uploads[slot];
    if (existing) return { composition: undefined, room: publicRoom(room) };
    participant.uploads[slot] = photo;
    room.lastActivityAt = now;
    const complete = room.participants.every((candidate) => candidate.uploads.filter(Boolean).length === SHARED_ROOM.captureCount);
    if (!complete) {
      notify(room);
      return { composition: undefined, room: publicRoom(room) };
    }
    room.status = "processing";
    notify(room);
    return {
      composition: {
        captureId,
        frameId: room.frameId,
        participants: room.participants.map((candidate) => ({ id: candidate.id, photos: candidate.uploads as PhotoInput[] })),
        storageId: room.storageId,
        token: room.token,
      } satisfies SharedRoomCompositionInput,
      room: publicRoom(room),
    };
  }

  complete(token: string, captureId: string, result: DownloadablePhotoStrip) {
    const room = getRoom(token);
    if (room.status !== "processing" || room.captureId !== captureId) return;
    room.result = result;
    room.status = "complete";
    room.lastActivityAt = Date.now();
    clearCaptureTimeout(room);
    clearRoomMedia(room);
    notify(room);
  }

  fail(token: string, captureId: string) {
    const room = getRoom(token);
    if (room.captureId !== captureId || room.status === "complete" || room.status === "failed") return;
    room.status = "failed";
    clearCaptureTimeout(room);
    clearRoomMedia(room);
    notify(room);
  }

  abort(token: string, credential: string, captureId: string) {
    const room = getRoom(token);
    participantFor(room, credential);
    if (!room.captureId || room.captureId !== captureId || !["capturing", "processing"].includes(room.status)) {
      throw new SharedRoomError("This capture sequence is no longer active.", "ROOM_STATE_CONFLICT", 409);
    }
    room.status = "failed";
    clearCaptureTimeout(room);
    clearRoomMedia(room);
    notify(room);
    return publicRoom(room);
  }

  result(token: string, credential: string) {
    const room = getRoom(token);
    participantFor(room, credential);
    if (room.status !== "complete" || !room.result) throw new SharedRoomError("Your strip is still being prepared.", "ROOM_STATE_CONFLICT", 409);
    return room.result;
  }

  subscribe(token: string, credential: string, callback: (snapshot: SharedRoomSnapshot) => void) {
    const room = getRoom(token);
    const participant = participantFor(room, credential);
    if (participant.presenceConnections >= SHARED_ROOM.maximumSseConnectionsPerParticipant) {
      throw new SharedRoomError("Too many room connections are open on this device.", "RATE_LIMITED", 429);
    }
    participant.presenceConnections += 1;
    room.lastActivityAt = Date.now();
    room.subscribers.add(callback);
    notify(room);
    return () => {
      if (!room.subscribers.delete(callback)) return;
      participant.presenceConnections = Math.max(0, participant.presenceConnections - 1);
      if (room.status === "lobby" && participant.presenceConnections === 0) participant.ready = false;
      notify(room);
    };
  }
}

export const sharedRoomStore = new InMemoryRoomStore();
