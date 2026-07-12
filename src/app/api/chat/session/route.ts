import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

/**
 * POST /api/chat/session — チャットセッション作成(Step3)
 * body: { category: RELATIONSHIP|SELF|BUSINESS|COMPATIBILITY|TODAY }
 * 既存のin_progressセッションが同カテゴリであればそれを継続として返す(重複作成を避ける)。
 */
const schema = z.object({
  category: z.enum(["RELATIONSHIP", "SELF", "BUSINESS", "COMPATIBILITY", "TODAY"]),
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

  const existing = await prisma.fortuneSession.findFirst({
    where: { userId, category: parsed.data.category, status: "in_progress" },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    const messages = await prisma.fortuneMessage.findMany({
      where: { sessionId: existing.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ sessionId: existing.id, messages, resumed: true });
  }

  const session = await prisma.fortuneSession.create({
    data: { userId, category: parsed.data.category, status: "in_progress" },
  });
  return NextResponse.json({ sessionId: session.id, messages: [], resumed: false });
}
