import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { redis } from "@/lib/redis";

/**
 * POST /api/line/link
 *
 * CL22: LINE連携の開始。連携コード(6桁)を発行し、ユーザーが公式LINEに
 * そのコードを送信すると、webhook側でアカウントを紐付ける方式。
 *
 * この方式(コード連携)を採用した理由:
 * - LINE Loginチャネル(OAuth)の追加開設が不要で、Messaging APIチャネル1つで完結する
 * - CEO2確定の面談チケット運用(公式LINE電話)と同じ公式アカウントに一本化できる
 *
 * 必要な外部設定(コードだけでは動かない):
 * - LINE Developers で Messaging API チャネルを開設
 * - LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN を .env に設定
 * - Webhook URL に {APP_URL}/api/line/webhook を登録
 */
export async function POST() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }

  // 6桁数字コード(10分有効)。Redisに code -> userId で保存する
  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
  await redis.set(`line:link:${code}`, userId, { ex: 60 * 10 });

  return NextResponse.json({
    linkCode: code,
    expiresInMinutes: 10,
    instruction: "公式LINEを友だち追加して、この6桁のコードをトークで送ってください。",
  });
}
