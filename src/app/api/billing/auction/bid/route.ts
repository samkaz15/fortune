import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

/**
 * POST /api/billing/auction/bid
 *
 * 週1回・24時間限定のオークション形式チケットへの入札API。
 * データレイヤー設計書⑫で明記した通り、同時入札の競合は
 * AuctionTicket.version による楽観ロックで検知する。
 *
 * 実施形式(CEO2確定, 2026-07-03): 公式LINE電話・1時間・対応者はCEO本人。
 * 開催日は固定(決め打ち)で、ユーザーは「その日の枠」に入札する。
 *
 * 入札ルール(CEO2確定): 現在の最高額 + 100円以上からのみ受け付ける
 * (1円刻みでの入札は不可。旧仕様から変更)。
 *
 * 実装方針(WBS CL10のリスク注記に対応):
 * - リアルタイム性はコスト優先でポーリング方式(フロント側で数秒間隔でGET)を前提とする
 * - Stripeの与信保留(Manual Capture)は本APIでは未実装。TODOとして明記し、
 *   Phase1では「入札=仮予約」までとし、決済確定は落札確定後の別バッチに委ねる設計にしている
 */

const MIN_BID_INCREMENT_JPY = 100;

const bidSchema = z.object({
  ticketId: z.string().uuid(),
  amountJpy: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(), // 楽観ロック用。GET /auction/:id で取得したversionを渡す
});

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  const parsed = bidSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const { ticketId, amountJpy, expectedVersion } = parsed.data;

  const ticket = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ticket.status !== "open" || new Date() > ticket.closesAt) {
    return NextResponse.json({ error: "AUCTION_CLOSED" }, { status: 409 });
  }
  const minimumAcceptableJpy = ticket.currentPriceJpy + MIN_BID_INCREMENT_JPY;
  if (amountJpy < minimumAcceptableJpy) {
    return NextResponse.json(
      {
        error: "BID_TOO_LOW",
        message: `現在の最高額より${MIN_BID_INCREMENT_JPY}円以上高い金額を入力してください`,
        currentPriceJpy: ticket.currentPriceJpy,
        minimumAcceptableJpy,
      },
      { status: 409 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 楽観ロック：expectedVersionと現在のversionが一致する場合のみ更新できる
      const updateResult = await tx.auctionTicket.updateMany({
        where: { id: ticketId, version: expectedVersion },
        data: { currentPriceJpy: amountJpy, version: { increment: 1 } },
      });
      if (updateResult.count === 0) {
        throw new BidConflictError();
      }

      // 直前の最高額入札者を outbid に更新する
      await tx.bid.updateMany({
        where: { ticketId, status: "active" },
        data: { status: "outbid" },
      });

      return tx.bid.create({
        data: { ticketId, userId, amountJpy, status: "active" },
      });
    });

    return NextResponse.json({ bidId: result.id, currentPriceJpy: amountJpy });
  } catch (e) {
    if (e instanceof BidConflictError) {
      const latest = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
      return NextResponse.json(
        {
          error: "BID_CONFLICT",
          message: "他のユーザーが先に入札しました。最新価格を確認してください。",
          currentPriceJpy: latest?.currentPriceJpy,
          currentVersion: latest?.version,
        },
        { status: 409 }
      );
    }
    throw e;
  }
}

class BidConflictError extends Error {}
