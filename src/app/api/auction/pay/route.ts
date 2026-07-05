/**
 * POST /api/auction/pay { ticketId, method: "stripe" | "bank" }
 * 落札者のみ。落札額の決済を開始する(仕様書§決済: Stripe+銀行振込)。
 * - stripe: Checkoutセッションを作成しURLを返す(webhookで即時反映・SLO 1秒以内)
 * - bank:   振込案内を返しステータスをpending_bankへ(入金確認は管理者が手動→paidへ)
 * 決済完了(paid)まで予約画面へは進めない。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

const schema = z.object({
  ticketId: z.string().uuid(),
  method: z.enum(["stripe", "bank"]),
});

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
  const { ticketId, method } = parsed.data;

  const ticket = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ticket.winnerUserId !== userId) return NextResponse.json({ error: "NOT_WINNER" }, { status: 403 });
  if (ticket.status !== "awaiting_payment" && ticket.status !== "pending_bank") {
    return NextResponse.json({ error: "INVALID_STATE", status: ticket.status }, { status: 409 });
  }

  if (method === "bank") {
    await prisma.auctionTicket.update({ where: { id: ticketId }, data: { status: "pending_bank" } });
    await prisma.auditLog.create({
      data: { actorType: "user", actorId: userId, action: "auction_pay_bank_selected", targetType: "auction_ticket", targetId: ticketId, metadata: { amountJpy: ticket.currentPriceJpy } },
    });
    return NextResponse.json({
      method: "bank",
      amountJpy: ticket.currentPriceJpy,
      instruction: "振込先口座はメールでご案内します。入金確認後(1営業日以内)、日程予約のご案内をお送りします。",
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: { name: `トークション落札: ${ticket.title}` },
          unit_amount: ticket.currentPriceJpy,
        },
        quantity: 1,
      },
    ],
    metadata: { userId, kind: "auction_win", ticketId },
    success_url: `${appUrl}/auction/reserve?ticketId=${ticketId}`,
    cancel_url: `${appUrl}/auction`,
  });

  return NextResponse.json({ method: "stripe", checkoutUrl: session.url });
}
