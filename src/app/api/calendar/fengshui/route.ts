/**
 * GET /api/calendar/fengshui?year=2026&month=7
 * 風水カレンダー(暦注下段×本人の四柱推命)。認証必須(本人の生年月日を使うため)。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { buildFengshuiMonth } from "@/lib/fortune-engine/fengshui-calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }
  const now = new Date();
  const year = Number(req.nextUrl.searchParams.get("year") ?? now.getFullYear());
  const month = Number(req.nextUrl.searchParams.get("month") ?? now.getMonth() + 1);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 404 });

  return NextResponse.json(buildFengshuiMonth(profile.birthDate, year, month));
}
