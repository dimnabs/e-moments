import { credentialFrom, errorResponse, jsonObject, roomResponse } from "@/server/shared-rooms/http";
import { sharedRoomStore } from "@/server/shared-rooms/services/in-memory-room-store";
import { validateBoolean, validateSharedFrameId } from "@/server/shared-rooms/validation/validate-shared-room";
import { SharedRoomError } from "@/server/shared-rooms/domain/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    return roomResponse({ room: sharedRoomStore.snapshot(token, credentialFrom(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const body = await jsonObject(request);
    if (!("ready" in body) && !("frameId" in body)) throw new SharedRoomError("Send ready and/or frameId.", "INVALID_ROOM_REQUEST", 400);
    const changes = {
      ...("frameId" in body ? { frameId: validateSharedFrameId(body.frameId) } : {}),
      ...("ready" in body ? { ready: validateBoolean(body.ready, "ready") } : {}),
    };
    return roomResponse({ room: sharedRoomStore.updateLobby(token, credentialFrom(request), changes) });
  } catch (error) {
    return errorResponse(error);
  }
}
