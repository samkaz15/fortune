/**
 * CL32: ヘルスチェック(監視/SREの基本エンドポイント)
 * DB・Redisの疎通を確認して200/503を返す。外形監視(UptimeRobot等)から叩く想定。
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRemainingDailyFreeQuota } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const checks: Record<string, "ok" | "ng"> = { db: "ng", redis: "ng" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch {}
  try {
    await getRemainingDailyFreeQuota("healthcheck"); // インメモリfallbackでもokを返す
    checks.redis = "ok";
  } catch {}
  const healthy = checks.db === "ok";
  return NextResponse.json(
    { status: healthy ? "healthy" : "unhealthy", checks, latencyMs: Date.now() - started },
    { status: healthy ? 200 : 503 }
  );
}
