import { NextResponse } from "next/server";
import { createLoginSession, passwordMatches } from "@/server/accounts/auth";
import { database } from "@/server/accounts/database";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const { email, password } = await request.json(); const result = await database().query<{ id: string; password_hash: string }>("select id, password_hash from app_user where email=$1", [typeof email === "string" ? email.trim().toLowerCase() : ""]); const user = result.rows[0]; if (!user || typeof password !== "string" || !(await passwordMatches(password, user.password_hash))) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 }); await createLoginSession(user.id); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "We couldn’t sign you in." }, { status: 500 }); } }
