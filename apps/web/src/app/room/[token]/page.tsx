import type { Metadata } from "next";
import { SharedPhotoBooth } from "@/components/shared-photo-booth/shared-photo-booth";

export const metadata: Metadata = { title: "Your private room | E-moment", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function RoomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedPhotoBooth token={token} />;
}
