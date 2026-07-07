import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";

/**
 * POST /api/account/cancel
 * 退会は論理削除(deletedAt)にとどめ、データレイヤー設計書⑧の方針通り
 * 90日間の猶予期間後にバッチで物理削除する想定(本APIでは論理削除のみ実装)。
 */
export async function POST() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
    prisma.subscription.updateMany({ where: { userId }, data: { status: "canceled", canceledAt: new Date() } }),
  ]);

  trackEvent("subscription_canceled", {}, userId); // 計測基盤(2026-07-07・Marketing-083)

  const res = NextResponse.json({ ok: true });
  res.cookies.delete("dev_user_id");
  return res;
}
