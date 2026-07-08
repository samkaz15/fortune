/**
 * GET /api/auction/status?ticketId=xxx
 * ポーリング用の軽量ステータス(仕様書§リアルタイム更新: 現在価格/残り時間/自分の状態のみ)。
 * 期限切れならlazyに終了処理を実行してから返す(cron失敗時のフェイルセーフ)。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { closeExpiredAuctions, openScheduledAuctions } from "@/lib/talkauction";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ticketId = req.nextUrl.searchParams.get("ticketId");
  if (!ticketId) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const now = new Date();
  let ticket = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // 開催時刻を迎えていたら開始(ポーリングだけで開催前→開催中UIが自動で切り替わる。要件②)
  if (ticket.status === "scheduled" && now >= ticket.opensAt && now < ticket.closesAt) {
    await openScheduledAuctions(now);
    ticket = (await prisma.auctionTicket.findUnique({ where: { id: ticketId } }))!;
  }

  if (ticket.status === "open" && now >= ticket.closesAt) {
    await closeExpiredAuctions(now);
    ticket = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const userId = await getCurrentUserId();
  let myBidJpy: number | null = null;
  let isTopBidder = false;
  if (userId) {
    const myTop = await prisma.bid.findFirst({
      where: { ticketId, userId },
      orderBy: { amountJpy: "desc" },
    });
    myBidJpy = myTop?.amountJpy ?? null;
    const top = await prisma.bid.findFirst({
      where: { ticketId },
      orderBy: [{ amountJpy: "desc" }, { createdAt: "asc" }],
    });
    isTopBidder = Boolean(top && top.userId === userId);
  }

  const bidCount = await prisma.bid.count({ where: { ticketId } });

  return NextResponse.json({
    status: ticket.status,
    currentPriceJpy: ticket.currentPriceJpy,
    bidCount, // 最低入札額の算出用(0件なら開始価格ちょうど、以降は現在価格+100円)
    version: ticket.version,
    opensAt: ticket.opensAt.toISOString(),
    closesAt: ticket.closesAt.toISOString(),
    serverNow: now.toISOString(), // 残り時間はサーバー時刻基準で計算(仕様書セキュリティ§2)
    myBidJpy,
    isTopBidder,
    isWinner: Boolean(userId && ticket.winnerUserId === userId),
  });
}
