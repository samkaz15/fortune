/**
 * POST /api/auction/reserve { ticketId, startsAt }
 * 空き枠から選択して予約確定(仕様書§日程予約)。二重予約はunique制約+枠検証で防止。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { isValidSlot, getAvailableSlots } from "@/lib/calendar-adapter";

const schema = z.object({ ticketId: z.string().uuid(), startsAt: z.string().datetime() });

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { ticketId, startsAt } = parsed.data;

  const ticket = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ticket.winnerUserId !== userId) return NextResponse.json({ error: "NOT_WINNER" }, { status: 403 });
  if (ticket.status !== "paid") return NextResponse.json({ error: "PAYMENT_REQUIRED" }, { status: 402 });

  // 枠の正当性をサーバー側で検証(クライアントの自由入力を信用しない)
  if (!isValidSlot(startsAt)) return NextResponse.json({ error: "INVALID_SLOT" }, { status: 400 });
  const stillAvailable = (await getAvailableSlots()).some((s) => s.startsAt === startsAt);
  if (!stillAvailable) return NextResponse.json({ error: "SLOT_TAKEN" }, { status: 409 });

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const r = await tx.auctionReservation.create({
        data: { ticketId, userId, scheduledAt: new Date(startsAt) },
      });
      await tx.auctionTicket.update({ where: { id: ticketId }, data: { status: "fulfilled" } });
      await tx.auditLog.create({
        data: { actorType: "user", actorId: userId, action: "auction_reserved", targetType: "auction_ticket", targetId: ticketId, metadata: { startsAt } },
      });
      return r;
    });
    return NextResponse.json({ reservationId: reservation.id, scheduledAt: startsAt });
  } catch {
    // ticketId unique制約 = 同一チケットの二重予約
    return NextResponse.json({ error: "ALREADY_RESERVED" }, { status: 409 });
  }
}
