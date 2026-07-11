import { NextRequest, NextResponse } from "next/server";
import { getRemainingDailyFreeQuota } from "@/lib/redis";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { generateDailyReport } from "@/lib/decision-report";
import { getWeatherContext } from "@/lib/weather";
import { calculateStreak } from "@/lib/streak";
import { jstToday } from "@/lib/jst";

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

  try {
    return await handleReport(req, userId);
  } catch (e) {
    // 2026-07-07: 原因調査のため詳細をサーバーログへ残す(Vercel Logsで追跡可能)
    console.error("[report/today] generation failed:", e instanceof Error ? e.stack ?? e.message : e);
    return NextResponse.json({ error: "REPORT_GENERATION_FAILED" }, { status: 500 });
  }
}

async function handleReport(req: NextRequest, userId: string) {
  // 入力ファースト(要件③ 2026-07-08): 画面で入力された名前・生年月日を受け取り、
  // プロフィールへ反映してから診断する(未登録なら作成、変更されていれば更新)。
  // レポートのキャッシュ単位(userId×reportDate)は従来どおり=DB変更なし。
  const inputName = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  const inputBirthDate = req.nextUrl.searchParams.get("birthDate") ?? "";
  const validInput =
    inputName.length > 0 && inputName.length <= 40 && /^\d{4}-\d{2}-\d{2}$/.test(inputBirthDate);

  // avatar列が本番DBに未追加でも落ちないよう、必要カラムのみ明示select(2026-07-07再発防止)
  let profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { name: true, birthDate: true },
  });
  if (validInput) {
    const bd = new Date(inputBirthDate + "T00:00:00Z");
    const changed = !profile || profile.name !== inputName || profile.birthDate.getTime() !== bd.getTime();
    if (changed) {
      await prisma.userProfile.upsert({
        where: { userId },
        create: { userId, name: inputName, birthDate: bd },
        update: { name: inputName, birthDate: bd },
      });
      profile = { name: inputName, birthDate: bd };
    }
  }
  if (!profile) {
    return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });
  }

  // JST基準の「今日」を起点にする(2026-07-11 Phase1指示A・要件②原因A対策)。
  // 旧: new Date()のUTC日付をそのまま使っていたため、JST 0:00〜8:59は前日のレポートが
  //     返り続けるバグがあった。jstToday()はJST日付をUTC0時のDateとして正規化して返す。
  const today = jstToday();
  // 期間タブ(UI仕様v5): today/week/month/nextMonth。同ロジック・同スキーマで、
  // 期間の代表日(週=週初の月曜/月=1日/来月=翌月1日)をシードにして生成・保存する。
  const period = req.nextUrl.searchParams.get("period") ?? "today";
  let reportDate = today; // todayは既にUTC0時に正規化済みのDate(jstToday()の戻り値)
  if (period === "week") {
    const dow = (reportDate.getUTCDay() + 6) % 7; // 月曜=0
    reportDate = new Date(reportDate.getTime() - dow * 86_400_000);
  } else if (period === "month") {
    reportDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  } else if (period === "nextMonth") {
    reportDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  }

  const existing = await prisma.dailyReport.findUnique({
    where: { userId_reportDate_period: { userId, reportDate, period } },
  });
  if (existing) {
    return NextResponse.json({ ...toResponse(existing), streak: (await calculateStreak(userId)).currentStreak, remainingFreeQuota: await getRemainingDailyFreeQuota(userId), isSubscribed: await hasActiveSub(userId) });
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
    date: reportDate, // 期間代表日をシードに(今日/週初/月初/翌月初で占い結果が変わる)
    periodLabel: period === "week" ? "今週" : period === "month" ? "今月" : period === "nextMonth" ? "来月" : "今日",
  });

  // 同時アクセスでの二重生成に備え、ユニーク制約違反時は既存を返す
  try {
    const saved = await prisma.dailyReport.create({
      data: {
        userId,
        reportDate,
        period,
        score: result.score,
        stars: result.stars,
        keywords: result.keywords,
        summary: result.summary,
        cautions: result.cautions,
        advice: result.advice,
        todayAction: result.todayAction,
        details: result.details as object,
        scoreBreakdown: result.scoreBreakdown as unknown as object,
        generatedBy: result.generatedBy,
      },
    });
  trackEvent("report_generated", {}, userId);
    return NextResponse.json({ ...toResponse(saved), streak: (await calculateStreak(userId)).currentStreak, remainingFreeQuota: await getRemainingDailyFreeQuota(userId), isSubscribed: await hasActiveSub(userId) });
  } catch {
    const raced = await prisma.dailyReport.findUnique({
      where: { userId_reportDate_period: { userId, reportDate, period } },
    });
    if (raced) return NextResponse.json({ ...toResponse(raced), streak: (await calculateStreak(userId)).currentStreak, remainingFreeQuota: await getRemainingDailyFreeQuota(userId), isSubscribed: await hasActiveSub(userId) });
    throw new Error("DailyReport save failed");
  }
}

async function hasActiveSub(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({ where: { userId, status: "active" } });
  return Boolean(sub);
}

function toResponse(r: {
  score: number;
  stars: number;
  keywords: unknown;
  summary: string;
  cautions: unknown;
  advice: string;
  todayAction: string;
  details?: unknown; // 旧行はnull(要件⑤の拡充ブロック。無ければクライアントは非表示)
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
    details: r.details ?? null,
  };
}
