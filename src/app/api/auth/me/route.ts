/** GET /api/auth/me — ヘッダー等がログイン状態・表示名・アバターを取得する軽量API */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ loggedIn: false });
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { displayName: true, avatar: true },
  });
  return NextResponse.json({
    loggedIn: true,
    displayName: profile?.displayName ?? null,
    avatar: profile?.avatar ?? null,
  });
}
