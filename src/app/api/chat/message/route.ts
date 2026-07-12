import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, requirePlan, PlanRequiredError, AuthRequiredError } from "@/lib/auth";
import { runChatTurn } from "@/lib/chat/pipeline";

/**
 * POST /api/chat/message — チャット1ターン送信(Step3)
 * body: { sessionId: string, message: string }
 *
 * Quota方針(要件・2026-07-08): 無料枠は1日Nメッセージまで。paid以外は残数チェックする。
 * 具体的な上限値は課金設計(Stripe Webhook実装)と合わせてCEO確認のうえ確定するため、
 * 現状は「member以上なら通す」制限のみ(guestはブロック)。TODO: Quota消費ロジック接続。
 */
const schema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requirePlan("member")).userId;
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

  try {
    const result = await runChatTurn({
      userId,
      sessionId: session.id,
      userMessage: parsed.data.message,
      category: session.category,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[chat/message] pipeline failed:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
