/**
 * CL28: BI/ダッシュボード用の集計API
 * dwh_daily_summaryビュー(CL25)とアプリテーブルからKPIを返す。
 * 認可: x-admin-secret ヘッダー(本番はIP制限/専用BIツールに置き換え予定)
 *
 * 2026-07-07拡張(Marketing-086・計測基盤): D1/D7/D30継続率・LTV・ファネルCVRを追加。
 * 「継続利用」の定義: AnalyticsEventが記録された日をアクティブ日とみなす
 * (chat_message/report_generated/free_reading_started等、何らかの操作イベント)。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RetentionRow {
  cohort_size: bigint;
  retained: bigint;
}

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [daily, categoryPop, payingUsers, totalUsers, subActive, d1, d7, d30, funnel, revenue] = await Promise.all([
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
    // D1継続率: 登録翌日にイベントを記録したユーザーの割合(登録から60日以内のコホート対象)
    prisma.$queryRaw<RetentionRow[]>`
      WITH cohort AS (
        SELECT id, DATE("createdAt") AS signup_date FROM users
        WHERE "createdAt" >= NOW() - INTERVAL '60 days' AND "createdAt" < NOW() - INTERVAL '1 day'
      ), activity AS (
        SELECT DISTINCT "userId", DATE("createdAt") AS active_date FROM analytics_events WHERE "userId" IS NOT NULL
      )
      SELECT COUNT(DISTINCT c.id) AS cohort_size,
             COUNT(DISTINCT CASE WHEN a.active_date = c.signup_date + 1 THEN c.id END) AS retained
      FROM cohort c LEFT JOIN activity a ON a."userId" = c.id`,
    // D7継続率
    prisma.$queryRaw<RetentionRow[]>`
      WITH cohort AS (
        SELECT id, DATE("createdAt") AS signup_date FROM users
        WHERE "createdAt" >= NOW() - INTERVAL '60 days' AND "createdAt" < NOW() - INTERVAL '7 days'
      ), activity AS (
        SELECT DISTINCT "userId", DATE("createdAt") AS active_date FROM analytics_events WHERE "userId" IS NOT NULL
      )
      SELECT COUNT(DISTINCT c.id) AS cohort_size,
             COUNT(DISTINCT CASE WHEN a.active_date = c.signup_date + 7 THEN c.id END) AS retained
      FROM cohort c LEFT JOIN activity a ON a."userId" = c.id`,
    // D30継続率
    prisma.$queryRaw<RetentionRow[]>`
      WITH cohort AS (
        SELECT id, DATE("createdAt") AS signup_date FROM users
        WHERE "createdAt" >= NOW() - INTERVAL '90 days' AND "createdAt" < NOW() - INTERVAL '30 days'
      ), activity AS (
        SELECT DISTINCT "userId", DATE("createdAt") AS active_date FROM analytics_events WHERE "userId" IS NOT NULL
      )
      SELECT COUNT(DISTINCT c.id) AS cohort_size,
             COUNT(DISTINCT CASE WHEN a.active_date = c.signup_date + 30 THEN c.id END) AS retained
      FROM cohort c LEFT JOIN activity a ON a."userId" = c.id`,
    // ファネルCVR: 無料占い完了→サブスク登録(全期間の絶対数。日々の変動より積み上げを見る指標)
    Promise.all([
      prisma.analyticsEvent.count({ where: { name: "free_reading_completed" } }),
      prisma.analyticsEvent.count({ where: { name: "checkout_started" } }),
      prisma.analyticsEvent.count({ where: { name: "subscription_started" } }),
    ]),
    // LTV簡易算出: 直近14日のサブスク課金額+クレジット課金額の合計 / 総ユーザー数
    prisma.$queryRaw<{ total_jpy: bigint | null }[]>`
      SELECT COALESCE(SUM(amount), 0) AS total_jpy FROM credit_transactions
      WHERE type = 'purchase' AND "createdAt" >= ${since}`,
  ]);

  const d1Row = d1[0];
  const d7Row = d7[0];
  const d30Row = d30[0];
  const [freeCompleted, checkoutStarted, subStarted] = funnel;
  const creditRevenue14d = Number(revenue[0]?.total_jpy ?? 0);
  const subRevenue14d = subActive * 980; // 概算(実際の課金額はStripe側が正だが速報値として算出)
  const ltvApprox = totalUsers > 0 ? Math.round((creditRevenue14d + subRevenue14d) / totalUsers) : 0;

  return NextResponse.json({
    period: { since: since.toISOString(), days: 14 },
    kpi: {
      totalUsers,
      activeSubscriptions: subActive,
      creditBuyers14d: payingUsers.length,
      subscriptionRate: totalUsers > 0 ? Number(((subActive / totalUsers) * 100).toFixed(2)) : 0,
    },
    retention: {
      d1: d1Row && Number(d1Row.cohort_size) > 0 ? Number(((Number(d1Row.retained) / Number(d1Row.cohort_size)) * 100).toFixed(1)) : null,
      d7: d7Row && Number(d7Row.cohort_size) > 0 ? Number(((Number(d7Row.retained) / Number(d7Row.cohort_size)) * 100).toFixed(1)) : null,
      d30: d30Row && Number(d30Row.cohort_size) > 0 ? Number(((Number(d30Row.retained) / Number(d30Row.cohort_size)) * 100).toFixed(1)) : null,
      cohortSizes: {
        d1: d1Row ? Number(d1Row.cohort_size) : 0,
        d7: d7Row ? Number(d7Row.cohort_size) : 0,
        d30: d30Row ? Number(d30Row.cohort_size) : 0,
      },
    },
    funnel: {
      freeReadingCompleted: freeCompleted,
      checkoutStarted,
      subscriptionStarted: subStarted,
      cvrReadingToCheckout: freeCompleted > 0 ? Number(((checkoutStarted / freeCompleted) * 100).toFixed(2)) : 0,
      cvrCheckoutToSubscription: checkoutStarted > 0 ? Number(((subStarted / checkoutStarted) * 100).toFixed(2)) : 0,
    },
    ltv: {
      approxPerUserJpy: ltvApprox,
      note: "簡易算出(直近14日のサブスク概算額+クレジット購入額の合計/総ユーザー数)。正確な値はStripeの実績データを要参照",
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
