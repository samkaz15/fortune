import { Redis } from "@upstash/redis";

/**
 * データレイヤー設計書 ⑤キャッシュ戦略 / ③保存先設計 に基づく実装。
 * - 1日5回までの利用回数カウンター → アトミックインクリメント
 * - AI生成中の重複リクエスト防止 → 分散ロック(Idempotency Key)
 * - 診断結果・ランキング等のキャッシュ
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

const DAILY_FREE_LIMIT = 5;

function todayKey(userId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (JST変換は本番でタイムゾーン処理を追加すること)
  return `usage:daily:${userId}:${today}`;
}

/**
 * 無料利用回数を1消費する。上限に達している場合は false を返す。
 * カテゴリ別ではなく「質問単位で合算5回」という現行仕様の理解で実装している
 * (要件定義CL4でカテゴリ別に分ける仕様に変わった場合はキー設計を category 込みに変更する)。
 */
export async function consumeDailyFreeQuota(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const key = todayKey(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    // 初回のみTTLを設定(日付が変わったら自動リセット)
    await redis.expire(key, 60 * 60 * 26); // 26時間(タイムゾーンのズレ吸収のバッファ込み)
  }
  if (count > DAILY_FREE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: DAILY_FREE_LIMIT - count };
}

export async function getRemainingDailyFreeQuota(userId: string): Promise<number> {
  const key = todayKey(userId);
  const count = Number((await redis.get<number>(key)) ?? 0);
  return Math.max(0, DAILY_FREE_LIMIT - count);
}

/**
 * AI生成中の二重送信防止用の分散ロック。
 * 同一ユーザーが連打しても、Sakana AIへの二重リクエストを防ぐ。
 */
export async function acquireGenerationLock(sessionId: string): Promise<boolean> {
  const key = `lock:generation:${sessionId}`;
  const ok = await redis.set(key, "1", { nx: true, ex: 30 });
  return ok === "OK";
}

export async function releaseGenerationLock(sessionId: string): Promise<void> {
  await redis.del(`lock:generation:${sessionId}`);
}
