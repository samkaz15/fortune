import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { calculateShichu } from "@/lib/fortune-engine/shichu";

/**
 * GET /api/calendar?year=2026&month=7
 *
 * 運気カレンダー(CL16)。四柱推命の日柱計算(shichu.ts)は暦計算のみで完結するため、
 * Sakana AI呼び出し・課金判定なしで1ヶ月分をまとめて計算できる
 * (=1日5回のクレジット消費とは無関係。カレンダー閲覧自体は無料機能とする)。
 *
 * 「毎月やるべきこと」は、月間の運気の波の傾向(上昇/下降/安定)から
 * 簡易的なアドバイスを1件添える(AI生成ではなく決定論的なルールベース。
 * Sakana AI呼び出しコストをかけずに月次サマリを提供する設計判断)。
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  const now = new Date();
  const year = Number(req.nextUrl.searchParams.get("year") ?? now.getFullYear());
  const month = Number(req.nextUrl.searchParams.get("month") ?? now.getMonth() + 1); // 1-12

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { birthDate: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1);
    const { wave } = calculateShichu(profile.birthDate, date);
    return { date: date.toISOString().slice(0, 10), wave };
  });

  const avg = Math.round(days.reduce((sum, d) => sum + d.wave, 0) / days.length);
  const firstHalfAvg = average(days.slice(0, Math.floor(days.length / 2)).map((d) => d.wave));
  const secondHalfAvg = average(days.slice(Math.floor(days.length / 2)).map((d) => d.wave));

  const monthlyAdvice = buildMonthlyAdvice(firstHalfAvg, secondHalfAvg);

  return NextResponse.json({
    year,
    month,
    days,
    monthlyAverage: avg,
    monthlyAdvice,
  });
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * CEO_STRATの「常にポジティブ・決め打ち」原則に従い、
 * 月の前半/後半どちらの傾向でも、必ず前向きな一文で締める。
 */
function buildMonthlyAdvice(firstHalf: number, secondHalf: number): string {
  if (secondHalf - firstHalf > 8) {
    return "月の後半に向けて、どんどん流れが良くなっていく月。前半は力を蓄える時間として使おう。";
  }
  if (firstHalf - secondHalf > 8) {
    return "月の前半が勝負どころ。序盤に動いた分だけ、後半の安定につながる月。";
  }
  return "月を通してムラのない、安定したペースをキープできる月。積み重ねがそのまま力になる。";
}
