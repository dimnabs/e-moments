import { credentialFrom, errorResponse, roomResponse } from "@/server/shared-rooms/http";
import { sharedRoomStore } from "@/server/shared-rooms/services/in-memory-room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    return roomResponse(sharedRoomStore.result(token, credentialFrom(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
