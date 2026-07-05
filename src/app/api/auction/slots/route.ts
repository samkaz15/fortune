/**
 * GET /api/auction/slots?ticketId=xxx
 * 決済完了(paid)した落札者のみ、カレンダー空き枠を取得できる(仕様書§日程予約)。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { getAvailableSlots } from "@/lib/calendar-adapter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }
  const ticketId = req.nextUrl.searchParams.get("ticketId");
  if (!ticketId) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const ticket = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ticket.winnerUserId !== userId) return NextResponse.json({ error: "NOT_WINNER" }, { status: 403 });
  if (ticket.status !== "paid") {
    // 決済が完了した場合のみ予約画面に進めるようにする(仕様書)
    return NextResponse.json({ error: "PAYMENT_REQUIRED", status: ticket.status }, { status: 402 });
  }

  const slots = await getAvailableSlots();
  return NextResponse.json({ slots });
}
