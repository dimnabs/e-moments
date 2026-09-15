import { credentialFrom, errorResponse, roomResponseHeaders } from "@/server/shared-rooms/http";
import { sharedRoomStore } from "@/server/shared-rooms/services/in-memory-room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };
const encoder = new TextEncoder();

function event(payload: object) {
  return encoder.encode(`event: room\ndata: ${JSON.stringify({ ...payload, serverTime: new Date().toISOString() })}\n\n`);
}

export async function GET(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const credential = credentialFrom(request);
    let dispose: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      dispose?.();
      try { controller?.close(); } catch { /* The consumer already closed the stream. */ }
    };
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
        const publish = (room: ReturnType<typeof sharedRoomStore.snapshot>) => {
          if (closed) return;
          try { streamController.enqueue(event({ room })); } catch { close(); }
        };
        dispose = sharedRoomStore.subscribe(token, credential, publish);
        heartbeat = setInterval(() => {
          if (closed) return;
          try {
            sharedRoomStore.snapshot(token, credential);
            streamController.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch { close(); }
        }, 15_000);
        heartbeat.unref?.();
        request.signal.addEventListener("abort", close, { once: true });
      },
      cancel: close,
    });
    return new Response(stream, {
      headers: {
        ...roomResponseHeaders,
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
