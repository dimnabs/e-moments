import { SHARED_ROOM } from "@/server/shared-rooms/domain/constants";
import { errorResponse, clientAddress, jsonObject, roomResponse } from "@/server/shared-rooms/http";
import { enforceRateLimit } from "@/server/shared-rooms/services/rate-limiter";
import { sharedRoomStore } from "@/server/shared-rooms/services/in-memory-room-store";
import { validateDisplayName, validateSharedFrameId } from "@/server/shared-rooms/validation/validate-shared-room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    enforceRateLimit(`room-create:${clientAddress(request)}`, SHARED_ROOM.creationRateLimit);
    const body = await jsonObject(request);
    const created = sharedRoomStore.create(validateSharedFrameId(body.frameId), validateDisplayName(body.displayName ?? "Host"));
    return roomResponse(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
