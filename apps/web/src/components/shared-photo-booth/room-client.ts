import type { Frame } from "@/components/product-shell/constants";

export type Participant = { id: string; displayName: string; role: "host" | "guest"; ready: boolean; presence: string; uploadedSlots: number[] };
export type Membership = { id: string; credential: string; role: "host" | "guest" };
export type Room = {
  token: string; revision: number; status: "lobby" | "capturing" | "processing" | "complete" | "failed";
  frameId: Frame["id"]; expiresAt: string; participants: Participant[];
  captureId?: string; captureAt?: string[]; startedAt?: string;
  result?: { downloadUrl: string; expiresAt: string };
};
export type Snapshot = { room: Room; serverTime: string };
export type Admission = Snapshot & { participant: Membership; inviteUrl: string };

export class RoomError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function roomRequest<T>(path: string, membership?: Membership | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (membership) headers.set("Authorization", `Bearer ${membership.credential}`);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  const timeout = AbortSignal.timeout(60_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await fetch(path, { ...init, signal, headers, cache: "no-store", referrerPolicy: "no-referrer" });
  const payload = await response.json();
  if (!response.ok) throw new RoomError(payload.error?.message || "We couldn’t reach this room. Please try again.", response.status);
  return payload as T;
}

export function saveMembership(token: string, membership: Membership) {
  sessionStorage.setItem(`e-moment-room:${token}`, JSON.stringify(membership));
}

export function readMembership(token: string): Membership | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(`e-moment-room:${token}`) || "null");
    return stored && typeof stored.id === "string" && typeof stored.credential === "string" && (stored.role === "host" || stored.role === "guest") ? stored : null;
  } catch { return null; }
}

/** Fetch streaming keeps the participant credential out of URLs and access logs. */
export async function watchRoom(path: string, membership: Membership, signal: AbortSignal, onSnapshot: (snapshot: Snapshot) => void) {
  const idle = new AbortController();
  let watchdog = setTimeout(() => idle.abort(), 35_000);
  const reconnectSignal = AbortSignal.any([signal, idle.signal]);
  let response: Response;
  try {
    response = await fetch(`${path}/events`, { headers: { Authorization: `Bearer ${membership.credential}` }, signal: reconnectSignal, cache: "no-store", referrerPolicy: "no-referrer" });
  } catch (error) { clearTimeout(watchdog); throw error; }
  if (!response.ok || !response.body) { clearTimeout(watchdog); throw new RoomError("The room connection was interrupted.", response.status); }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => idle.abort(), 35_000);
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (data) {
          const snapshot = JSON.parse(data) as Snapshot;
          if (snapshot.room) onSnapshot(snapshot);
        }
      }
    }
  } finally { clearTimeout(watchdog); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
