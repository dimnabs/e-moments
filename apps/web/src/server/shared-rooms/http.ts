import { StorageConfigurationError } from "../solo-photo-strips/domain/errors";
import { SHARED_ROOM } from "./domain/constants";
import { SharedRoomError } from "./domain/errors";

export const roomResponseHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function roomResponse(payload: object, status = 200) {
  return Response.json({ ...payload, serverTime: new Date().toISOString() }, { headers: roomResponseHeaders, status });
}

export function errorResponse(error: unknown) {
  if (error instanceof SharedRoomError) return Response.json({ error: { code: error.code, message: error.message } }, { headers: roomResponseHeaders, status: error.status });
  if (error instanceof StorageConfigurationError) return Response.json({ error: { code: "STORAGE_CONFIGURATION_ERROR", message: "Photo storage is not configured yet." } }, { headers: roomResponseHeaders, status: 500 });
  return Response.json({ error: { code: "SHARED_ROOM_REQUEST_FAILED", message: "We couldn’t update this room. Please try again." } }, { headers: roomResponseHeaders, status: 502 });
}

export function credentialFrom(request: Request) {
  const value = request.headers.get("authorization");
  const match = value?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/);
  if (!match) throw new SharedRoomError("A participant credential is required.", "INVALID_PARTICIPANT_CREDENTIAL", 401);
  return match[1];
}

export async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new SharedRoomError("Send a JSON request body.", "INVALID_ROOM_REQUEST", 400);
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > SHARED_ROOM.maximumJsonBytes) throw new SharedRoomError("This request is too large.", "INVALID_ROOM_REQUEST", 413);
    if (!request.body) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > SHARED_ROOM.maximumJsonBytes) {
        await reader.cancel();
        throw new SharedRoomError("This request is too large.", "INVALID_ROOM_REQUEST", 413);
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder().decode(body));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new SharedRoomError("Send a valid JSON request body.", "INVALID_ROOM_REQUEST", 400);
  }
}

/** Enforces a byte cap before multipart parsing so a forged Content-Length cannot exhaust memory. */
export async function cappedMultipartFormData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) throw new SharedRoomError("Send the photo as multipart form data.", "INVALID_ROOM_REQUEST", 400);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > SHARED_ROOM.maximumMultipartBytes) {
    throw new SharedRoomError("This photo is too large. Please keep each photo under 6 MB.", "INVALID_ROOM_REQUEST", 413);
  }
  if (!request.body) throw new SharedRoomError("Send the photo as multipart form data.", "INVALID_ROOM_REQUEST", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > SHARED_ROOM.maximumMultipartBytes) {
      await reader.cancel();
      throw new SharedRoomError("This photo is too large. Please keep each photo under 6 MB.", "INVALID_ROOM_REQUEST", 413);
    }
    chunks.push(value);
  }
  try {
    return await new Response(new Blob(chunks.map((chunk) => new Uint8Array(chunk).buffer as ArrayBuffer)), { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new SharedRoomError("Send the photo as multipart form data.", "INVALID_ROOM_REQUEST", 400);
  }
}

export function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

export function idempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) return undefined;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw new SharedRoomError("Idempotency-Key must be 8 to 128 URL-safe characters.", "INVALID_ROOM_REQUEST", 400);
  return value;
}
