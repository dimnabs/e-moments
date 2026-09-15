#!/usr/bin/env node

/**
 * Milestone 3 live API smoke test.
 *
 * Usage (with the web app and MinIO already running):
 *
 *   node scripts/test-shared-session.mjs
 *   E_MOMENT_BASE_URL=http://127.0.0.1:3000 node scripts/test-shared-session.mjs
 *
 * The test uses generated red/blue images only. It never logs room tokens,
 * participant credentials, invite links, or signed download URLs.
 */

import sharp from "sharp";

const baseUrl = (process.env.E_MOMENT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const captureCount = 4;
const requestTimeoutMs = 15_000;
const completionTimeoutMs = 120_000;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withTimeout(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function credentialHeaders(member) {
  return member ? { Authorization: `Bearer ${member.credential}` } : {};
}

async function api(label, path, options = {}) {
  const headers = new Headers(options.headers || {});
  Object.entries(credentialHeaders(options.member)).forEach(([key, value]) => headers.set(key, value));
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${label} timed out`)), requestTimeoutMs);
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.json === undefined ? options.body : JSON.stringify(options.json),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${label} timed out`);
    if (error instanceof Error && error.message === `${label} timed out`) throw error;
    throw new Error(`${label} could not reach the web app`);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : undefined;
  } catch {
    payload = undefined;
  }

  if (options.status !== undefined && response.status !== options.status) {
    const code = payload?.error?.code ? ` (${payload.error.code})` : "";
    throw new Error(`${label} returned HTTP ${response.status}, expected ${options.status}${code}`);
  }
  if (options.ok && !response.ok) {
    const code = payload?.error?.code ? ` (${payload.error.code})` : "";
    throw new Error(`${label} returned HTTP ${response.status}${code}`);
  }
  return { response, payload };
}

function participant(snapshot, role) {
  return snapshot.room.participants.find((entry) => entry.role === role);
}

function roomPath(token, suffix = "") {
  return `/api/rooms/${encodeURIComponent(token)}${suffix}`;
}

async function openEvents(label, token, member) {
  const controller = new AbortController();
  let response;
  try {
    response = await withTimeout(fetch(`${baseUrl}${roomPath(token, "/events")}`, {
      headers: credentialHeaders(member),
      signal: controller.signal,
      cache: "no-store",
    }), requestTimeoutMs, `${label} SSE connection timed out`);
  } catch (error) {
    controller.abort();
    if (error instanceof Error && error.message === `${label} SSE connection timed out`) throw error;
    throw new Error(`${label} SSE connection failed`);
  }
  if (!response.ok || !response.body) {
    controller.abort();
    throw new Error(`${label} SSE connection returned HTTP ${response.status}`);
  }

  const queue = [];
  const waiters = [];
  let buffer = "";
  const decoder = new TextDecoder();
  const stream = response.body.getReader();

  function publish(snapshot) {
    const waiter = waiters.shift();
    if (waiter) waiter(snapshot);
    else queue.push(snapshot);
  }

  const readerTask = (async () => {
    try {
      while (true) {
        const { done, value } = await stream.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event.split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (data) {
            try {
              const snapshot = JSON.parse(data);
              if (snapshot?.room) publish(snapshot);
            } catch {
              // Ignore comments or malformed events; the HTTP API remains authoritative.
            }
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        for (const waiter of waiters.splice(0)) waiter(Promise.reject(error));
      }
    } finally {
      stream.releaseLock();
    }
  })();

  return {
    async next() {
      if (queue.length) return queue.shift();
      return new Promise((resolve) => waiters.push(resolve));
    },
    async close() {
      controller.abort();
      await readerTask.catch(() => {});
    },
  };
}

async function waitForSse(label, events, predicate, timeout = 15_000) {
  return withTimeout((async () => {
    while (true) {
      const snapshot = await events.next();
      if (predicate(snapshot)) return snapshot;
    }
  })(), timeout, `${label} SSE did not reach the expected state`);
}

async function waitForRoom(label, token, member, predicate, timeout = completionTimeoutMs) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const { payload } = await api(label, roomPath(token), { member, ok: true });
    if (predicate(payload)) return payload;
    await sleep(500);
  }
  throw new Error(`${label} did not reach the expected state`);
}

async function solidImage(color) {
  return sharp({
    create: { width: 320, height: 320, channels: 3, background: color },
  }).png().toBuffer();
}

async function upload(token, member, captureId, slot, image, label) {
  const form = new FormData();
  form.set("captureId", captureId);
  form.set("photo", new Blob([image], { type: "image/png" }), `${label}-${slot}.png`);
  return api(`${label} upload ${slot + 1}`, roomPath(token, `/photos/${slot}`), {
    method: "POST",
    member,
    body: form,
    ok: true,
  });
}

function closeEnough(actual, expected, tolerance = 24) {
  return Math.abs(actual[0] - expected[0]) <= tolerance
    && Math.abs(actual[1] - expected[1]) <= tolerance
    && Math.abs(actual[2] - expected[2]) <= tolerance;
}

async function validateStrip(buffer) {
  const metadata = await sharp(buffer).metadata();
  assert(metadata.format === "png", "completed download is not PNG");
  assert(metadata.width === 1200 && metadata.height === 1950, "completed strip has unexpected dimensions");

  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelAt = (x, y) => {
    const offset = (y * info.width + x) * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  // The shared compositor places the host on the left and guest on the right.
  assert(closeEnough(pixelAt(250, 300), [255, 0, 0]), "host photo color was not preserved");
  assert(closeEnough(pixelAt(850, 300), [0, 0, 255]), "guest photo color was not preserved");
}

async function main() {
  console.log(`Running shared-session smoke test against ${baseUrl}`);

  const created = await api("room creation", "/api/rooms", {
    method: "POST",
    json: { frameId: "cherry", displayName: "Smoke Host" },
    status: 201,
  });
  const token = created.payload?.room?.token;
  const host = created.payload?.participant;
  assert(typeof token === "string" && token.length >= 32, "room creation did not return a room token");
  assert(host?.role === "host" && typeof host.credential === "string", "room creation did not return host credentials");

  await api("unauthenticated room read", roomPath(token), { status: 401 });

  const joined = await api("guest join", roomPath(token, "/join"), {
    method: "POST",
    headers: { "Idempotency-Key": "smoke-guest-join-1" },
    json: { displayName: "Smoke Guest" },
    status: 201,
  });
  const guest = joined.payload?.participant;
  assert(guest?.role === "guest" && typeof guest.credential === "string", "guest join did not return guest credentials");

  const thirdJoin = await api("third participant rejection", roomPath(token, "/join"), {
    method: "POST",
    headers: { "Idempotency-Key": "smoke-third-join-1" },
    json: { displayName: "Smoke Third" },
    status: 409,
  });
  assert(thirdJoin.payload?.error?.code === "ROOM_FULL", "third participant rejection used an unexpected error code");
  console.log("✓ create, authenticated access, guest join, and third-participant rejection");

  const hostEvents = await openEvents("host", token, host);
  const guestEvents = await openEvents("guest", token, guest);
  try {
    await Promise.all([
      waitForSse("host presence", hostEvents, (snapshot) => participant(snapshot, "host")?.presence === "online" && participant(snapshot, "guest")?.presence === "online"),
      waitForSse("guest presence", guestEvents, (snapshot) => participant(snapshot, "host")?.presence === "online" && participant(snapshot, "guest")?.presence === "online"),
    ]);

    await api("host ready", roomPath(token), { method: "PATCH", member: host, json: { ready: true }, status: 200 });
    await api("guest ready", roomPath(token), { method: "PATCH", member: guest, json: { ready: true }, status: 200 });
    await Promise.all([
      waitForSse("host readiness", hostEvents, (snapshot) => participant(snapshot, "host")?.ready && participant(snapshot, "guest")?.ready),
      waitForSse("guest readiness", guestEvents, (snapshot) => participant(snapshot, "host")?.ready && participant(snapshot, "guest")?.ready),
    ]);

    const guestStart = await api("guest start rejection", roomPath(token, "/start"), { method: "POST", member: guest, status: 403 });
    assert(guestStart.payload?.error?.code === "HOST_REQUIRED", "guest start rejection used an unexpected error code");

    const started = await api("host start", roomPath(token, "/start"), { method: "POST", member: host, status: 200 });
    const captureId = started.payload?.room?.captureId;
    const captureAt = started.payload?.room?.captureAt;
    assert(typeof captureId === "string" && Array.isArray(captureAt) && captureAt.length === captureCount, "start did not return four capture timestamps");
    const captureTimes = captureAt.map((value) => Date.parse(value));
    assert(captureTimes.every(Number.isFinite), "start returned an invalid capture timestamp");
    assert(captureTimes.every((value, index) => index === 0 || value > captureTimes[index - 1]), "capture timestamps are not ordered");
    console.log("✓ presence, readiness, host-only start, and four server capture timestamps");

    const [hostImage, guestImage] = await Promise.all([solidImage("#ff0000"), solidImage("#0000ff")]);
    for (let slot = 0; slot < captureCount; slot += 1) {
      const wait = captureTimes[slot] - Date.now();
      if (wait > 0) await sleep(wait);
      await upload(token, host, captureId, slot, hostImage, "host");
      await upload(token, guest, captureId, slot, guestImage, "guest");
      if (slot === 0) {
        const duplicate = await upload(token, host, captureId, slot, hostImage, "host duplicate");
        assert(duplicate.response.ok, "duplicate upload retry was not accepted");
      }
    }
    console.log("✓ four red/blue synthetic uploads per participant and duplicate retry");

    const completed = await Promise.all([
      waitForRoom("host completion", token, host, (snapshot) => snapshot.room?.status === "complete"),
      waitForRoom("guest completion", token, guest, (snapshot) => snapshot.room?.status === "complete"),
    ]);
    assert(completed.every((snapshot) => snapshot.room.status === "complete"), "room did not complete");

    const [hostResult, guestResult] = await Promise.all([
      api("host result", roomPath(token, "/result"), { member: host, status: 200 }),
      api("guest result", roomPath(token, "/result"), { member: guest, status: 200 }),
    ]);
    const hostDownload = hostResult.payload?.downloadUrl;
    const guestDownload = guestResult.payload?.downloadUrl;
    assert(typeof hostDownload === "string" && typeof guestDownload === "string", "completed result did not return signed downloads");
    assert(hostDownload === guestDownload, "participants received different signed downloads");
    assert(new URL(hostDownload).search.length > 0, "completed result URL is not signed");
    const signedResponse = await fetch(hostDownload);
    assert(signedResponse.ok, "signed download was not accessible");
    const signedBytes = Buffer.from(await signedResponse.arrayBuffer());
    const guestSignedResponse = await fetch(guestDownload);
    assert(guestSignedResponse.ok, "guest signed download was not accessible");
    const guestSignedBytes = Buffer.from(await guestSignedResponse.arrayBuffer());
    assert(Buffer.compare(signedBytes, guestSignedBytes) === 0, "participants received different strip bytes");
    await validateStrip(signedBytes);

    const unsignedUrl = new URL(hostDownload);
    unsignedUrl.search = "";
    const unsignedResponse = await fetch(unsignedUrl);
    assert(!unsignedResponse.ok, "unsigned object URL was accessible");
    console.log("✓ both participants received the same private signed PNG; unsigned object access denied");
  } finally {
    await Promise.all([hostEvents.close(), guestEvents.close()]);
  }

  console.log("Shared-session smoke test passed.");
}

main().catch((error) => {
  console.error(`Shared-session smoke test failed: ${error instanceof Error ? error.message : "unexpected error"}`);
  process.exitCode = 1;
});
