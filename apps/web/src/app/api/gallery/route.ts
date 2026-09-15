import { NextResponse } from "next/server";
import { currentUser } from "@/server/accounts/auth";
import { sessionsForUser } from "@/server/gallery/repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { const user = await currentUser(); if (!user) return NextResponse.json({ error: "Sign in to view your gallery." }, { status: 401 }); return NextResponse.json({ sessions: await sessionsForUser(user.id) }, { headers: { "Cache-Control": "private, no-store" } }); }
