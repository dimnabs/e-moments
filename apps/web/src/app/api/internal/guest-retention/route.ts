import { NextResponse } from "next/server";
import { expiredGuestMedia } from "@/server/gallery/retention";
import { markDeleted } from "@/server/gallery/repository";
import { S3ObjectStorageRepository } from "@/server/solo-photo-strips/repositories/s3-object-storage-repository";
export const runtime = "nodejs";
export async function POST(request: Request) { if (!process.env.RETENTION_CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.RETENTION_CRON_SECRET}`) return new NextResponse(null, { status: 401 }); const rows = await expiredGuestMedia(); const grouped = Map.groupBy(rows, (row) => row.id); const storage = new S3ObjectStorageRepository(); for (const [id, media] of grouped) { await storage.deletePrivateObjects(media.map((row) => row.storage_key)); await markDeleted(id); } return NextResponse.json({ purged: grouped.size }); }
