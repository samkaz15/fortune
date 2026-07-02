import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

/**
 * GET /api/fortune/result/:id
 * 画面遷移設計書「診断結果」画面のデータ取得API。
 * 未ログイン/未課金でも要約(summary)までは返し、全文(bodyText)は
 * isUnlocked=true のときのみ返す(ペイウォール設計⑦を参照)。
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await prisma.fortuneResult.findUnique({
    where: { id: params.id },
  });

  if (!result) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const viewerId = await getCurrentUserId();
  const isOwner = viewerId === result.userId;

  // サブスク会員は自動解放。所有者以外はロック状態を維持する。
  let isUnlocked = result.isUnlocked;
  if (isOwner && !isUnlocked) {
    const subscription = await prisma.subscription.findUnique({ where: { userId: result.userId } });
    isUnlocked = subscription?.status === "active";
  }

  return NextResponse.json({
    id: result.id,
    scoreOverall: result.scoreOverall,
    summary: result.summary,
    nextActions: result.nextActions,
    isUnlocked,
    bodyText: isUnlocked ? result.bodyText : null,
    createdAt: result.createdAt,
  });
}
