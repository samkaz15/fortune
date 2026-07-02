import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** GET /api/auction — 開催中/開催予定のチケット一覧(ポーリング用の軽量エンドポイント) */
export async function GET() {
  const tickets = await prisma.auctionTicket.findMany({
    where: { status: { in: ["open", "scheduled"] } },
    orderBy: { opensAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      startPriceJpy: true,
      currentPriceJpy: true,
      status: true,
      opensAt: true,
      closesAt: true,
      version: true,
      _count: { select: { bids: true } },
    },
  });
  return NextResponse.json({ tickets });
}
