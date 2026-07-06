import { NextRequest, NextResponse } from "next/server";
import { getRemainingDailyFreeQuota } from "@/lib/redis";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { generateDailyReport } from "@/lib/decision-report";
import { getWeatherContext } from "@/lib/weather";

/**
 * GET /api/report/today
 *
 * 「今日の意思決定レポート」(CEO_UPDATE 2026-07-03)。
 * - 1ユーザー1日1件。生成済みならDBから即返却(LLMコスト・体感速度の両面で必須)
 * - 1日5回の質問クォータは消費しない(毎日開く動機の中核=無料機能とする設計判断)
 * - lat/lonクエリがあれば天気→人間行動キーワード翻訳を反映
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });
  }

  const today = new Date();
  const reportDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  const existing = await prisma.dailyReport.findUnique({
    where: { userId_reportDate: { userId, reportDate } },
  });
  if (existing) {
    return NextResponse.json({ ...toResponse(existing), remainingFreeQuota: await getRemainingDailyFreeQuota(userId) });
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const weather =
    !Number.isNaN(lat) && !Number.isNaN(lon) ? await getWeatherContext(lat, lon) : null;

  const familyName = profile.name.slice(0, 1); // TODO: 姓名分離保存(既存TODOと同一課題)
  const givenName = profile.name.slice(1);

  const result = await generateDailyReport({
    userId,
    profile: { familyName, givenName, birthDate: profile.birthDate },
    weather,
    date: today,
  });

  // 同時アクセスでの二重生成に備え、ユニーク制約違反時は既存を返す
  try {
    const saved = await prisma.dailyReport.create({
      data: {
        userId,
        reportDate,
        score: result.score,
        stars: result.stars,
        keywords: result.keywords,
        summary: result.summary,
        cautions: result.cautions,
        advice: result.advice,
        todayAction: result.todayAction,
        scoreBreakdown: result.scoreBreakdown as unknown as object,
        generatedBy: result.generatedBy,
      },
    });
  trackEvent("report_generated", {}, userId);
    return NextResponse.json({ ...toResponse(saved), remainingFreeQuota: await getRemainingDailyFreeQuota(userId) });
  } catch {
    const raced = await prisma.dailyReport.findUnique({
      where: { userId_reportDate: { userId, reportDate } },
    });
    if (raced) return NextResponse.json({ ...toResponse(raced), remainingFreeQuota: await getRemainingDailyFreeQuota(userId) });
    throw new Error("DailyReport save failed");
  }
}

function toResponse(r: {
  score: number;
  stars: number;
  keywords: unknown;
  summary: string;
  cautions: unknown;
  advice: string;
  todayAction: string;
  reportDate: Date;
}) {
  return {
    reportDate: r.reportDate.toISOString().slice(0, 10),
    score: r.score,
    stars: r.stars,
    keywords: r.keywords,
    summary: r.summary,
    cautions: r.cautions,
    advice: r.advice,
    todayAction: r.todayAction,
  };
}
