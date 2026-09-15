import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

import { database } from "./database";

const scrypt = promisify(scryptCallback);
const COOKIE = "e_moment_session";
const SESSION_DAYS = 30;

function hashToken(token: string) { return Buffer.from(token).toString("base64url"); }
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("base64url")}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [salt, value] = stored.split(":");
  if (!salt || !value) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(value, "base64url");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const result = await database().query<{ id: string; email: string; name: string | null }>(
    `select u.id, u.email, u.name from app_session s join app_user u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`, [hashToken(token)],
  );
  return result.rows[0] ?? null;
}
export async function createLoginSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await database().query("insert into app_session (user_id, token_hash, expires_at) values ($1, $2, $3)", [userId, hashToken(token), expiresAt]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}
export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await database().query("delete from app_session where token_hash = $1", [hashToken(token)]);
  store.delete(COOKIE);
}
