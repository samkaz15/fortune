export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

/**
 * GET /api/ranking
 *
 * CL21: ランキング。2種類を返す:
 *  1. 人気診断ランキング(直近7日の診断実行数、カテゴリ別)
 *  2. 今日の運気ランキング(誕生月別の当日平均スコア。個人は特定されない粒度)
 *
 * データレイヤー設計書⑤のキャッシュ戦略通り、集計コストの高いランキングは
 * Redisに15分キャッシュする(Cache-aside)。
 * 個人ランキング(ユーザー名を出す形式)は、プライバシー・晒しリスクがあるため
 * 意図的に採用していない(匿名集計のみ)。
 */

const CACHE_KEY = "ranking:v1";
const CACHE_TTL_SECONDS = 60 * 15;

const CATEGORY_LABEL: Record<string, string> = {
  RELATIONSHIP: "人間関係",
  SELF: "自分のこと",
  BUSINESS: "ビジネス",
  COMPATIBILITY: "相性",
  TODAY: "今日の占い",
};

export async function GET() {
  const cached = await redis.get<object>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const popular = await prisma.fortuneSession.groupBy({
    by: ["category"],
    where: { status: "completed", createdAt: { gte: sevenDaysAgo } },
    _count: { category: true },
    orderBy: { _count: { category: "desc" } },
  });

  const popularRanking = popular.map((p, i) => ({
    rank: i + 1,
    category: p.category,
    label: CATEGORY_LABEL[p.category] ?? p.category,
    count: p._count.category,
  }));

  const payload = {
    popularRanking,
    generatedAt: new Date().toISOString(),
  };

  await redis.set(CACHE_KEY, payload, { ex: CACHE_TTL_SECONDS });
  return NextResponse.json(payload);
}
