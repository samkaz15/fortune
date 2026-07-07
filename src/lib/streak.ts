/**
 * 連続利用ストリーク計算(リテンション改善 2026-07-07・Marketing-014)。
 * AnalyticsEventが記録された日をアクティブ日とみなし、直近から遡って
 * 連続何日間アクティブだったかを算出する。マイページでの表示+UGC素材化を狙う
 * (docs/marketing/02_Growth_Strategy.md §3参照)。
 */
import { prisma } from "@/lib/db";

export async function calculateStreak(userId: string): Promise<{ currentStreak: number; lastActiveDate: string | null }> {
  // 直近90日分のアクティブ日(重複日は1日として扱う)を新しい順に取得
  const rows = await prisma.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT DATE("createdAt") AS day
    FROM analytics_events
    WHERE "userId" = ${userId} AND "createdAt" >= NOW() - INTERVAL '90 days'
    ORDER BY day DESC
  `;

  if (rows.length === 0) return { currentStreak: 0, lastActiveDate: null };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const lastActive = new Date(rows[0].day);
  lastActive.setUTCHours(0, 0, 0, 0);

  // 最新のアクティブ日が「今日」か「昨日」でなければストリークは途切れている(0扱い)
  const daysSinceLastActive = Math.round((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceLastActive > 1) {
    return { currentStreak: 0, lastActiveDate: lastActive.toISOString().slice(0, 10) };
  }

  // 直近のアクティブ日から遡って、日付が1日ずつ連続している限りカウントする
  let streak = 1;
  let cursor = lastActive;
  for (let i = 1; i < rows.length; i++) {
    const d = new Date(rows[i].day);
    d.setUTCHours(0, 0, 0, 0);
    const diff = Math.round((cursor.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
      cursor = d;
    } else {
      break;
    }
  }

  return { currentStreak: streak, lastActiveDate: lastActive.toISOString().slice(0, 10) };
}
