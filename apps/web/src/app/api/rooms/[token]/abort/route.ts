import { credentialFrom, errorResponse, jsonObject, roomResponse } from "@/server/shared-rooms/http";
import { sharedRoomStore } from "@/server/shared-rooms/services/in-memory-room-store";
import { validateCaptureId } from "@/server/shared-rooms/validation/validate-shared-room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const body = await jsonObject(request);
    return roomResponse({ room: sharedRoomStore.abort(token, credentialFrom(request), validateCaptureId(body.captureId ?? null)) });
  } catch (error) {
    return errorResponse(error);
  }
}
