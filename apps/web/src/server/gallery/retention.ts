import { database } from "@/server/accounts/database";
export async function expiredGuestMedia() {
  const result = await database().query<{ id: string; storage_key: string }>(`select s.id, m.storage_key from photo_session s join media_object m on m.session_id=s.id where s.owner_id is null and s.deleted_at is null and s.guest_purge_at <= now()`);
  return result.rows;
}
