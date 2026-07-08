/** GET /api/auth/me — ヘッダー等がログイン状態・表示名・アバターを取得する軽量API */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ loggedIn: false });
  // avatar列が本番DBに未追加でも落ちないよう防御(列追加SQL適用前の互換性)
  let displayName: string | null = null;
  let avatar: string | null = null;
  let hasProfile = false; // 名前・生年月日が登録済みか(今日の運勢の入力スキップ判定。要件④ 2026-07-08)
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { displayName: true, avatar: true, name: true, birthDate: true },
    });
    displayName = profile?.displayName ?? null;
    avatar = profile?.avatar ?? null;
    hasProfile = Boolean(profile?.name && profile?.birthDate);
  } catch {
    // avatarカラム未追加の環境: displayNameだけ取得を試みる
    try {
      const p2 = await prisma.userProfile.findUnique({ where: { userId }, select: { displayName: true, name: true, birthDate: true } });
      displayName = p2?.displayName ?? null;
      hasProfile = Boolean(p2?.name && p2?.birthDate);
    } catch {
      /* noop */
    }
  }
  return NextResponse.json({ loggedIn: true, displayName, avatar, hasProfile });
}
