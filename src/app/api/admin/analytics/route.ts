/**
 * CL28: BI/ダッシュボード用の集計API
 * dwh_daily_summaryビュー(CL25)とアプリテーブルからKPIを返す。
 * 認可: x-admin-secret ヘッダー(本番はIP制限/専用BIツールに置き換え予定)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [daily, categoryPop, payingUsers, totalUsers, subActive] = await Promise.all([
    prisma.$queryRaw<
      { day: Date; name: string; events: bigint; unique_users: bigint; total_tokens: bigint }[]
    >`SELECT day, name, events, unique_users, total_tokens FROM dwh_daily_summary WHERE day >= ${since}::date ORDER BY day DESC, name`,
    prisma.fortuneSession.groupBy({
      by: ["category"],
      _count: { _all: true },
      where: { createdAt: { gte: since } },
    }),
    prisma.creditTransaction.findMany({
      where: { type: "purchase", createdAt: { gte: since } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.user.count(),
    prisma.subscription.count({ where: { status: "active" } }),
  ]);

  return NextResponse.json({
    period: { since: since.toISOString(), days: 14 },
    kpi: {
      totalUsers,
      activeSubscriptions: subActive,
      creditBuyers14d: payingUsers.length,
      subscriptionRate: totalUsers > 0 ? Number(((subActive / totalUsers) * 100).toFixed(2)) : 0,
    },
    categoryPopularity: categoryPop.map((c: { category: string; _count: { _all: number } }) => ({ category: c.category, sessions: c._count._all })),
    dailySummary: daily.map((d: { day: Date; name: string; events: bigint; unique_users: bigint; total_tokens: bigint }) => ({
      day: d.day,
      name: d.name,
      events: Number(d.events),
      uniqueUsers: Number(d.unique_users),
      totalTokens: Number(d.total_tokens),
    })),
  });
}
