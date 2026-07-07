export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { calculateShichu } from "@/lib/fortune-engine/shichu";

/**
 * GET /api/shrines
 *
 * CL18: おすすめ神社。全神社を返しつつ、ログイン済みユーザーには
 * 「今日のあなたへのおすすめ」を1件添える。
 *
 * おすすめロジック(Phase2の簡易版):
 * 当日の運気スコア帯によって、推すご利益タグを切り替える決定論的ルール。
 *   高スコア(80+) → 「仕事運」「金運」(攻めの日は行動系のご利益)
 *   中スコア      → 「総合運」「開運」
 *   低スコア      → 「厄除け」「癒し」
 * Phase3の推薦基盤(CL27)でSakana AI連携の協調フィルタリングに置き換える予定。
 */
export async function GET(_req: NextRequest) {
  const shrines = await prisma.shrine.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      reviews: {
        where: { authorType: "ceo" },
        select: { id: true },
        take: 1,
      },
    },
  });

  const shrineList = shrines.map((s) => ({
    id: s.id,
    name: s.name,
    prefecture: s.prefecture,
    city: s.city,
    tags: s.tags,
    hasCeoReview: s.reviews.length > 0,
  }));

  // ログイン済みならパーソナライズおすすめを添える
  let recommendation: { shrineId: string; reason: string } | null = null;
  const userId = await getCurrentUserId();
  if (userId) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { birthDate: true },
    });
    if (profile && shrines.length > 0) {
      const { wave } = calculateShichu(profile.birthDate, new Date());
      const preferredTags = wave >= 80 ? ["仕事運", "金運"] : wave >= 50 ? ["総合運", "開運"] : ["厄除け", "癒し"];

      const matched =
        shrines.find((s) => {
          const tags = (s.tags as string[]) ?? [];
          return preferredTags.some((t) => tags.includes(t));
        }) ?? shrines[0];

      const reasonByBand =
        wave >= 80
          ? "今日は運気が高い日。行動系のご利益がある場所に足を運ぶと、さらに流れに乗れるよ。"
          : wave >= 50
            ? "今日は流れの安定した日。総合運を底上げしてくれる場所がぴったり。"
            : "今日は自分を整える日。心を落ち着けられる場所で、明日への力を蓄えよう。";

      recommendation = { shrineId: matched.id, reason: reasonByBand };
    }
  }

  return NextResponse.json({ shrines: shrineList, recommendation });
}
