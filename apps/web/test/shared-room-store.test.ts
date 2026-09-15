import assert from "node:assert/strict";
import test from "node:test";

import { SharedRoomError } from "../src/server/shared-rooms/domain/errors.js";
import { InMemoryRoomStore } from "../src/server/shared-rooms/services/in-memory-room-store.js";

const photo = { buffer: Buffer.from("a"), contentType: "image/jpeg" as const };

function expectRoomError(action: () => unknown, code: string) {
  assert.throws(action, (error: unknown) => error instanceof SharedRoomError && error.code === code);
}

test("a room has two credentialed participants and idempotent joins", () => {
  const store = new InMemoryRoomStore();
  const created = store.create("cherry", "Host");
  const joined = store.join(created.room.token, "Partner", "join-key-1");
  const retried = store.join(created.room.token, "Ignored", "join-key-1");

  assert.equal(joined.participant.credential, retried.participant.credential);
  assert.equal(joined.room.participants.length, 2);
  expectRoomError(() => store.snapshot(created.room.token, "invalid"), "INVALID_PARTICIPANT_CREDENTIAL");
  expectRoomError(() => store.join(created.room.token, "Third"), "ROOM_FULL");
});

test("disconnecting in a lobby clears readiness and the server owns capture timestamps", () => {
  const store = new InMemoryRoomStore();
  const created = store.create("lilac", "Host");
  const joined = store.join(created.room.token, "Partner");
  const hostConnection = store.subscribe(created.room.token, created.participant.credential, () => undefined);
  const guestConnection = store.subscribe(created.room.token, joined.participant.credential, () => undefined);

  store.updateLobby(created.room.token, created.participant.credential, { ready: true });
  store.updateLobby(created.room.token, joined.participant.credential, { ready: true });
  const started = store.start(created.room.token, created.participant.credential);
  assert.equal(started.status, "capturing");
  assert.equal(started.captureAt?.length, 4);
  assert.equal(new Date(started.captureAt![1]).getTime() - new Date(started.captureAt![0]).getTime(), 5_000);
  expectRoomError(() => store.join(created.room.token, "Late"), "ROOM_STATE_CONFLICT");

  hostConnection();
  guestConnection();
  const lobby = store.create("midnight", "Other host");
  const other = store.join(lobby.room.token, "Other guest");
  const connection = store.subscribe(lobby.room.token, lobby.participant.credential, () => undefined);
  store.updateLobby(lobby.room.token, lobby.participant.credential, { ready: true });
  connection();
  assert.equal(store.snapshot(lobby.room.token, lobby.participant.credential).participants[0].ready, false);
  assert.equal(store.snapshot(lobby.room.token, other.participant.credential).participants[0].presence, "offline");
});

test("eight accepted slot uploads transition once to processing and tolerate a retry", () => {
  const store = new InMemoryRoomStore();
  const created = store.create("cherry", "Host");
  const joined = store.join(created.room.token, "Partner");
  const offHost = store.subscribe(created.room.token, created.participant.credential, () => undefined);
  const offGuest = store.subscribe(created.room.token, joined.participant.credential, () => undefined);
  store.updateLobby(created.room.token, created.participant.credential, { ready: true });
  store.updateLobby(created.room.token, joined.participant.credential, { ready: true });
  const started = store.start(created.room.token, created.participant.credential);
  const originalNow = Date.now;
  try {
    for (let slot = 0; slot < 4; slot += 1) {
      Date.now = () => new Date(started.captureAt![slot]).getTime();
      store.addPhoto(created.room.token, created.participant.credential, started.captureId!, slot, photo);
      const accepted = store.addPhoto(created.room.token, joined.participant.credential, started.captureId!, slot, photo);
      if (slot === 3) assert.ok(accepted.composition);
    }
  } finally {
    Date.now = originalNow;
  }
  assert.equal(store.snapshot(created.room.token, created.participant.credential).status, "processing");
  store.complete(created.room.token, started.captureId!, { downloadUrl: "https://example.test/strip", expiresAt: new Date().toISOString() });
  const retry = store.addPhoto(created.room.token, created.participant.credential, started.captureId!, 3, photo);
  assert.equal(retry.room.status, "complete");
  offHost();
  offGuest();
});
