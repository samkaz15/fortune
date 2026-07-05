/**
 * POST /api/auction/close (CRON_SECRET保護)
 * 24時間経過したオークションを自動終了する(仕様書§オークション終了処理)。
 * Vercel Cronで5分間隔実行を想定。ステータスAPI側のlazy実行が二重の保険。
 */
import { NextRequest, NextResponse } from "next/server";
import { closeExpiredAuctions } from "@/lib/talkauction";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const result = await closeExpiredAuctions();
  return NextResponse.json(result);
}
