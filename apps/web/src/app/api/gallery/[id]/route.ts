import { NextResponse } from "next/server";
import { currentUser } from "@/server/accounts/auth";
import { markDeleted, mediaForDeletion } from "@/server/gallery/repository";
import { S3ObjectStorageRepository } from "@/server/solo-photo-strips/repositories/s3-object-storage-repository";
export const runtime = "nodejs";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; const user = await currentUser(); const guestToken = request.headers.get("x-e-moment-deletion-token") ?? undefined; const keys = await mediaForDeletion(id, user?.id ?? null, guestToken); if (!keys.length) return NextResponse.json({ error: "That moment was not found." }, { status: 404 }); try { await new S3ObjectStorageRepository().deletePrivateObjects(keys); await markDeleted(id); return new NextResponse(null, { status: 204 }); } catch { return NextResponse.json({ error: "We couldn’t permanently delete this moment. Please try again." }, { status: 502 }); } }
