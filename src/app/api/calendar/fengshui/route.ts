/**
 * GET /api/calendar/fengshui?year=2026&month=7
 * 風水カレンダー(暦注下段×本人の四柱推命)。認証必須(本人の生年月日を使うため)。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { buildFengshuiMonth, buildGeneralMonth, buildPersonalExtras } from "@/lib/fortune-engine/fengshui-calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const now = new Date();
  const year = Number(req.nextUrl.searchParams.get("year") ?? now.getFullYear());
  const month = Number(req.nextUrl.searchParams.get("month") ?? now.getMonth() + 1);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  // 非会員/未登録: 一般カレンダー(吉日・意味・行動は閲覧可)+登録誘導(UI仕様v5)
  const profile = userId
    ? await prisma.userProfile.findUnique({ where: { userId }, select: { birthDate: true } })
    : null;
  if (!profile) {
    return NextResponse.json({
      ...buildGeneralMonth(year, month),
      personal: false,
      signupPrompt: "登録すると自分専用カレンダーになります",
    });
  }

  const base = buildFengshuiMonth(profile.birthDate, year, month);
  const extras = buildPersonalExtras(profile.birthDate);
  return NextResponse.json({ ...base, ...extras, personal: true });
}
