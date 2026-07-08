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
 * 入札ルール(要件② 2026-07-08で更新。旧2026-07-05ルールを置き換え):
 * - 金額は100円刻み(100の倍数)のみ。初回=開始価格1,000円、以降=現在価格+100円が最低額
 * - キャンセル不可への同意・免責事項への同意(チェックボックス2つ)をサーバー側でも必須検証
 *
 * 実装方針(WBS CL10のリスク注記に対応):
 * - リアルタイム性はコスト優先でポーリング方式(フロント側で数秒間隔でGET)を前提とする
 * - Stripeの与信保留(Manual Capture)は本APIでは未実装。TODOとして明記し、
 *   Phase1では「入札=仮予約」までとし、決済確定は落札確定後の別バッチに委ねる設計にしている
 */

const bidSchema = z.object({
  ticketId: z.string().uuid(),
  amountJpy: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(), // 楽観ロック用。ステータスAPIで取得したversionを渡す
  // 仕様書§入札フロー: 確認モーダルのチェックボックス。フロントを信用せずサーバーでも検証する
  agreedNoCancel: z.literal(true),
  agreedDisclaimer: z.literal(true),
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
  // サーバー時刻のみで開催中を判定(仕様書セキュリティ§1,2: 開催時間外・不正価格・未認証は必ず拒否)
  const now = new Date();
  if (ticket.status !== "open" || now < ticket.opensAt || now >= ticket.closesAt) {
    return NextResponse.json({ error: "AUCTION_CLOSED" }, { status: 409 });
  }
  // 入札ルール(要件② 2026-07-08。旧「現在価格以上+同額先着」ルールを置き換え):
  // - 金額は100円刻み(100の倍数)のみ有効
  // - 初回入札は開始価格(1,000円)ちょうどから。以降は現在価格+100円が最低額
  //   → 同額入札はルール上発生しないため、旧・同額先着分岐は撤去した
  const bidCount = await prisma.bid.count({ where: { ticketId } });
  const minimumAcceptableJpy = bidCount > 0 ? ticket.currentPriceJpy + 100 : ticket.startPriceJpy;
  if (amountJpy % 100 !== 0) {
    return NextResponse.json(
      {
        error: "BID_INVALID_STEP",
        message: "入札は100円単位でお願いします",
        currentPriceJpy: ticket.currentPriceJpy,
        minimumAcceptableJpy,
      },
      { status: 409 }
    );
  }
  if (amountJpy < minimumAcceptableJpy) {
    return NextResponse.json(
      {
        error: "BID_TOO_LOW",
        message: `${minimumAcceptableJpy.toLocaleString()}円以上の金額を入力してください`,
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

    // 監査ログ(仕様書セキュリティ§6: 入札履歴を管理者が確認できるように保存)
    await prisma.auditLog.create({
      data: { actorType: "user", actorId: userId, action: "auction_bid", targetType: "auction_ticket", targetId: ticketId, metadata: { amountJpy, bidId: result.id } },
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
