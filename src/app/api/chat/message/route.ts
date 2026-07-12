import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlan, PlanRequiredError, AuthRequiredError } from "@/lib/auth";
import { runChatTurn } from "@/lib/chat/pipeline";
import { consumeDailyFreeQuota, refundDailyFreeQuota, FREE_MEMBER_DAILY_LIMIT } from "@/lib/redis";

/**
 * POST /api/chat/message — チャット1ターン送信(Step3)
 * body: { sessionId: string, message: string }
 *
 * Quota(2026-07-12接続・CEO_QUOTA_definition準拠):
 * - paid: 5回/日 / member(無料): 1回/日 / guest: 401
 * - カウント定義は「錦糸町の少年からの返信が届いた回数」— LLM生成に失敗して
 *   フォールバック文言しか返せなかった場合・パイプライン例外時は1回分を払い戻す
 * - 超過時は 402 QUOTA_EXCEEDED(UI側でアップグレード導線を出す)
 */
const PAID_DAILY_LIMIT = 5;
const schema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  let userId: string;
  let plan: "member" | "paid" | "guest";
  try {
    const r = await requirePlan("member");
    userId = r.userId;
    plan = r.plan as "member" | "paid";
  } catch (e) {
    if (e instanceof PlanRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const session = await prisma.fortuneSession.findUnique({ where: { id: parsed.data.sessionId } });
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  }

  // Quota消費(plan別上限)。超過は402
  const limit = plan === "paid" ? PAID_DAILY_LIMIT : FREE_MEMBER_DAILY_LIMIT;
  const quota = await consumeDailyFreeQuota(userId, limit);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "QUOTA_EXCEEDED", plan, limit },
      { status: 402 }
    );
  }

  try {
    const result = await runChatTurn({
      userId,
      sessionId: session.id,
      userMessage: parsed.data.message,
      category: session.category,
    });
    if (!result.llmSucceeded) {
      await refundDailyFreeQuota(userId); // 返信を届けられなかった分は枠を戻す
    }
    return NextResponse.json({ ...result, remaining: result.llmSucceeded ? quota.remaining : quota.remaining + 1 });
  } catch (e) {
    console.error("[chat/message] pipeline failed:", e);
    await refundDailyFreeQuota(userId).catch(() => {});
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
