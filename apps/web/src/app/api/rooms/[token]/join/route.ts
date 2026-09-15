import { errorResponse, idempotencyKey, jsonObject, roomResponse } from "@/server/shared-rooms/http";
import { sharedRoomStore } from "@/server/shared-rooms/services/in-memory-room-store";
import { validateDisplayName } from "@/server/shared-rooms/validation/validate-shared-room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const body = await jsonObject(request);
    return roomResponse(sharedRoomStore.join(token, validateDisplayName(body.displayName ?? "Guest"), idempotencyKey(request)), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
