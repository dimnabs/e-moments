import { NextResponse } from "next/server";
import { currentUser } from "@/server/accounts/auth";
import { sessionsForUser } from "@/server/gallery/repository";
import { S3ObjectStorageRepository } from "@/server/solo-photo-strips/repositories/s3-object-storage-repository";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { const user = await currentUser(); if (!user) return NextResponse.json({ error: "Sign in to download this strip." }, { status: 401 }); const { id } = await context.params; const session = (await sessionsForUser(user.id)).find((candidate) => candidate.id === id); if (!session) return NextResponse.json({ error: "That moment was not found." }, { status: 404 }); return NextResponse.json(await new S3ObjectStorageRepository().createDownloadUrl(session.outputKey), { headers: { "Cache-Control": "private, no-store" } }); }
