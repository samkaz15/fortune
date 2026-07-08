export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextScheduleWindows, openScheduledAuctions, closeExpiredAuctions } from "@/lib/talkauction";

/**
 * GET /api/auction — 開催中/開催予定のチケット一覧
 * - 開始/終了の状態遷移をlazyに実行してから返す(cron失敗時のフェイルセーフ)
 * - チケットが無い場合でも次回開催ウィンドウ(nextWindows)とserverNowを返し、
 *   フロントは開催前カウントダウンUIを描画できる(要件② 2026-07-08)
 */
export async function GET() {
  const now = new Date();
  await openScheduledAuctions(now);
  await closeExpiredAuctions(now);

  const tickets = await prisma.auctionTicket.findMany({
    where: { status: { in: ["open", "scheduled"] } },
    orderBy: { opensAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      profileText: true,
      topics: true,
      startPriceJpy: true,
      currentPriceJpy: true,
      status: true,
      opensAt: true,
      closesAt: true,
      version: true,
      _count: { select: { bids: true } },
    },
  });
  return NextResponse.json({
    tickets,
    serverNow: now.toISOString(),
    nextWindows: nextScheduleWindows(now),
  });
}
