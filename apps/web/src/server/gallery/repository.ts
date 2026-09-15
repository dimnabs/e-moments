import { randomBytes, randomUUID } from "node:crypto";
import { database } from "@/server/accounts/database";
import type { StoredObject } from "@/server/solo-photo-strips/domain/types";

export type GallerySession = { id: string; frameId: string; completedAt: string; outputKey: string; isGuest: boolean };
export async function saveCompletedSession(input: { ownerId: string | null; frameId: string; media: StoredObject[] }) {
  const id = randomUUID();
  const deletionToken = input.ownerId ? null : randomBytes(24).toString("base64url");
  const purgeAt = input.ownerId ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const db = database();
  await db.query("begin");
  try {
    await db.query("insert into photo_session (id, owner_id, frame_id, guest_deletion_token, guest_purge_at) values ($1,$2,$3,$4,$5)", [id, input.ownerId, input.frameId, deletionToken, purgeAt]);
    await Promise.all(input.media.map((object) => db.query("insert into media_object (session_id, storage_key, content_type, kind) values ($1,$2,$3,$4)", [id, object.key, object.contentType, object.key.endsWith("e-moment-photo-strip.png") ? "strip" : "original"])));
    await db.query("commit");
  } catch (error) { await db.query("rollback"); throw error; }
  return { id, deletionToken, guestPurgeAt: purgeAt?.toISOString() };
}
export async function sessionsForUser(ownerId: string) {
  const result = await database().query<GallerySession>(`select s.id, s.frame_id as "frameId", s.completed_at::text as "completedAt", m.storage_key as "outputKey", false as "isGuest"
    from photo_session s join media_object m on m.session_id=s.id and m.kind='strip' where s.owner_id=$1 and s.deleted_at is null order by s.completed_at desc`, [ownerId]);
  return result.rows;
}
export async function mediaForDeletion(id: string, ownerId: string | null, deletionToken?: string) {
  const ownerClause = ownerId ? "s.owner_id = $2" : "s.owner_id is null and s.guest_deletion_token = $2";
  const credential = ownerId ?? deletionToken;
  const result = await database().query<{ storage_key: string }>(`select m.storage_key from photo_session s join media_object m on m.session_id=s.id where s.id=$1 and ${ownerClause} and s.deleted_at is null`, [id, credential]);
  return result.rows.map((row) => row.storage_key);
}
export async function markDeleted(id: string) { await database().query("update photo_session set deleted_at=now() where id=$1", [id]); }
