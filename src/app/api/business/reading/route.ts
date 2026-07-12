import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlan, PlanRequiredError, AuthRequiredError } from "@/lib/auth";
import { buildShoubuCalendar, independenceTiming } from "@/lib/business-fortune";

/**
 * POST /api/business/reading — ビジネス占い(GM9優先度最高 / 2026-07-12)
 * body: { year?: number, month?: number }(省略時は当月)
 * 返却: 勝負所カレンダー + 独立・転職タイミング診断
 *
 * 提供範囲(GM9課金設計に対応):
 * - member: 当月の勝負所ベスト3日+タイミング診断の結論のみ(お試し)
 * - paid: 当月フルカレンダー+タイミング診断の根拠全文
 * ※単発商品(四半期戦略レポート¥999等)はStripeダッシュボードでのPrice作成後に接続
 */
const schema = z.object({
  year: z.number().int().min(1900).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

export async function POST(req: NextRequest) {
  let userId: string;
  let plan: string;
  try {
    const r = await requirePlan("member");
    userId = r.userId;
    plan = r.plan;
  } catch (e) {
    if (e instanceof PlanRequiredError || e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });

  const now = new Date(Date.now() + 9 * 3600_000); // JST
  const year = parsed.data.year ?? now.getUTCFullYear();
  const month = parsed.data.month ?? now.getUTCMonth() + 1;

  const calendar = buildShoubuCalendar(profile.birthDate, year, month);
  const timing = independenceTiming(profile.birthDate, profile.birthTime, profile.gender);

  if (plan !== "paid") {
    // 無料会員はベスト3日+結論のみ(ペイウォール)
    const top3 = calendar.filter((d) => d.rating === "best").slice(0, 3);
    return NextResponse.json({
      plan,
      year,
      month,
      calendar: top3.length > 0 ? top3 : calendar.filter((d) => d.rating === "good").slice(0, 3),
      timing: timing ? { recommendation: timing.recommendation, currentPhase: timing.currentPhase } : null,
      locked: true,
    });
  }

  return NextResponse.json({ plan, year, month, calendar, timing, locked: false });
}
