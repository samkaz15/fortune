/**
 * CL26: AI Feature Store
 *
 * Sakana AI(分析層)へ渡すユーザー特徴量を、バージョン付きで保存・再利用する。
 * GM10調査「コンテンツは一発勝負ではなく資産化(記憶)する」の実装。
 *
 * - 特徴量は再計算のたびに version をインクリメントして追記(上書きしない)
 *   → どの時点の特徴量で鑑定したかを後から追跡できる(MLOpsの基本)
 * - 読み取りは常に最新版(getLatestFeatures)
 * - 計算コスト削減のため、直近6時間以内に計算済みならそれを返す
 */
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";

export interface UserFeatureSnapshot {
  consultCount30d: number;
  favoriteCategory: string | null;
  avgScore30d: number | null;
  activeDays30d: number;
  isSubscriber: boolean;
  version: number;
}

const FRESH_MS = 6 * 60 * 60 * 1000; // 6時間

export async function getOrComputeUserFeatures(userId: string): Promise<UserFeatureSnapshot> {
  const latest = await prisma.userFeature.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
  });
  if (latest && Date.now() - latest.computedAt.getTime() < FRESH_MS) {
    return toSnapshot(latest);
  }
  return computeAndStore(userId, (latest?.version ?? 0) + 1);
}

async function computeAndStore(userId: string, version: number): Promise<UserFeatureSnapshot> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [sessions, reports, subscription] = await Promise.all([
    prisma.fortuneSession.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { category: true, createdAt: true },
    }),
    prisma.dailyReport.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { score: true },
    }),
    prisma.subscription.findFirst({ where: { userId, status: "active" } }),
  ]);

  // 最多カテゴリ
  const counts = new Map<string, number>();
  const days = new Set<string>();
  for (const s of sessions) {
    counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    days.add(s.createdAt.toISOString().slice(0, 10));
  }
  let favoriteCategory: string | null = null;
  let max = 0;
  for (const [cat, n] of counts) {
    if (n > max) {
      max = n;
      favoriteCategory = cat;
    }
  }

  const avgScore30d =
    reports.length > 0 ? reports.reduce((a: number, r: { score: number }) => a + r.score, 0) / reports.length : null;

  const row = await prisma.userFeature.create({
    data: {
      id: randomUUID(),
      userId,
      version,
      consultCount30d: sessions.length,
      favoriteCategory,
      avgScore30d,
      activeDays30d: days.size,
      isSubscriber: Boolean(subscription),
    },
  });
  return toSnapshot(row);
}

function toSnapshot(row: {
  consultCount30d: number;
  favoriteCategory: string | null;
  avgScore30d: number | null;
  activeDays30d: number;
  isSubscriber: boolean;
  version: number;
}): UserFeatureSnapshot {
  return {
    consultCount30d: row.consultCount30d,
    favoriteCategory: row.favoriteCategory,
    avgScore30d: row.avgScore30d,
    activeDays30d: row.activeDays30d,
    isSubscriber: row.isSubscriber,
    version: row.version,
  };
}
