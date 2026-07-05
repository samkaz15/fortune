/**
 * トークション(電話占いオークションMVP)のドメインロジック
 * 仕様書: docs/design/08_talkauction/talkauction_spec.md
 *
 * - 出品は週2回固定: 月曜7:00開始 / 金曜20:00開始(いずれもJST・24時間開催)
 * - 終了判定はサーバー時刻のみを使用(クライアント時刻を信用しない・仕様書セキュリティ§2)
 * - 落札者決定: 最高額。同額は先に入札したユーザーを優先(amount DESC, createdAt ASC)
 * - 延長/自動キャンセル/自動再出品は実装しない(MVP対象外)
 */
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JSTの「次の開催ウィンドウ」を返す(月7:00-火7:00 / 金20:00-土20:00) */
export function nextScheduleWindows(now: Date = new Date()): { opensAt: Date; closesAt: Date }[] {
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const windows: { opensAt: Date; closesAt: Date }[] = [];
  // 直近14日を走査して月/金の開始時刻を列挙(シンプル・保守優先)
  for (let d = 0; d < 14; d++) {
    const day = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + d));
    const dow = day.getUTCDay(); // JST基準の曜日
    let hour: number | null = null;
    if (dow === 1) hour = 7; // 月曜 7:00
    if (dow === 5) hour = 20; // 金曜 20:00
    if (hour === null) continue;
    const opensJst = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour);
    const opensAt = new Date(opensJst - JST_OFFSET_MS); // JST→UTC
    const closesAt = new Date(opensAt.getTime() + 24 * 60 * 60 * 1000);
    if (closesAt.getTime() > now.getTime()) windows.push({ opensAt, closesAt });
    if (windows.length >= 2) break;
  }
  return windows;
}

/** サーバー時刻での開催中判定 */
export function isOpenNow(ticket: { status: string; opensAt: Date; closesAt: Date }, now: Date = new Date()): boolean {
  return ticket.status === "open" && now >= ticket.opensAt && now < ticket.closesAt;
}

/**
 * 期限切れオークションの終了処理(仕様書§オークション終了処理の順序どおり)
 * 1.終了 2.新規入札停止(status変更で自動的に停止) 3.最終価格確定
 * 4.最高入札者取得(同額は先着) 5.落札者決定 6.決済待ちへ変更
 * cron(POST /api/auction/close)とページ読込時のlazy実行の両方から呼ばれる。
 */
export async function closeExpiredAuctions(now: Date = new Date()): Promise<{ closed: number }> {
  const expired = await prisma.auctionTicket.findMany({
    where: { status: "open", closesAt: { lte: now } },
    select: { id: true },
  });

  let closed = 0;
  for (const { id } of expired) {
    await prisma.$transaction(async (tx) => {
      // 二重実行防止: openのままのときだけ閉じる
      const res = await tx.auctionTicket.updateMany({
        where: { id, status: "open" },
        data: { status: "closed" },
      });
      if (res.count === 0) return;

      // 最高額・同額先着(amount DESC, createdAt ASC)
      const top = await tx.bid.findFirst({
        where: { ticketId: id },
        orderBy: [{ amountJpy: "desc" }, { createdAt: "asc" }],
      });

      if (!top) return; // 入札なし: closedのまま(自動再出品はしない)

      await tx.bid.update({ where: { id: top.id }, data: { status: "won" } });
      await tx.auctionTicket.update({
        where: { id },
        data: {
          status: "awaiting_payment",
          winningBidId: top.id,
          winnerUserId: top.userId,
          currentPriceJpy: top.amountJpy,
        },
      });
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          actorType: "system",
          action: "auction_won",
          targetType: "auction_ticket",
          targetId: id,
          metadata: { bidId: top.id, userId: top.userId, amountJpy: top.amountJpy },
        },
      });
    });
    closed++;
  }
  return { closed };
}
