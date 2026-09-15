import { NextResponse } from "next/server";
import { createLoginSession, passwordHash } from "@/server/accounts/auth";
import { database } from "@/server/accounts/database";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 12 || password.length > 200) return NextResponse.json({ error: "Use a valid email and a password of at least 12 characters." }, { status: 400 });
    const result = await database().query<{ id: string }>("insert into app_user (email, password_hash, name) values ($1,$2,$3) returning id", [email.trim().toLowerCase(), await passwordHash(password), typeof name === "string" ? name.trim().slice(0, 80) || null : null]);
    await createLoginSession(result.rows[0].id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 }); return NextResponse.json({ error: "We couldn’t create your account." }, { status: 500 }); }
}
