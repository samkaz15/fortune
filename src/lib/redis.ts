import { Redis } from "@upstash/redis";

/**
 * データレイヤー設計書 ⑤キャッシュ戦略 / ③保存先設計 に基づく実装。
 * - 1日5回までの利用回数カウンター → アトミックインクリメント
 * - AI生成中の重複リクエスト防止 → 分散ロック(Idempotency Key)
 * - 診断結果・ランキング等のキャッシュ
 *
 * UPSTASH_REDIS_REST_URL 未設定の環境(ローカル開発・CI)では、
 * インメモリ実装に自動フォールバックする。単一プロセス内でのみ有効なため、
 * 本番では必ずUpstashを設定すること(複数インスタンス間で共有されないと
 * カウンター・分散ロックの意味がなくなる)。
 */

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: unknown; expiresAt: number | null }>();

  private isExpired(entry: { expiresAt: number | null }): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }

  private cleanGet(key: string) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async incr(key: string): Promise<number> {
    const entry = this.cleanGet(key);
    const current = typeof entry?.value === "number" ? entry.value : Number(entry?.value ?? 0);
    const next = current + 1;
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.cleanGet(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cleanGet(key);
    return (entry?.value as T) ?? null;
  }

  async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<string | null> {
    if (opts?.nx && this.cleanGet(key)) return null;
    this.store.set(key, {
      value,
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null,
    });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

function createRedis(): RedisLike {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new Redis({ url, token }) as unknown as RedisLike;
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[redis] UPSTASH_REDIS_REST_URL is not set in production. Falling back to in-memory store — counters and locks will NOT be shared across instances."
    );
  }
  return new InMemoryRedis();
}

export const redis: RedisLike = createRedis();

const DAILY_FREE_LIMIT = 5; // 有料会員の1日あたり質問回数
export const FREE_MEMBER_DAILY_LIMIT = 1; // 無料会員は1回まで(UI仕様v5 2026-07-06)

function todayKey(userId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (JST変換は本番でタイムゾーン処理を追加すること)
  return `usage:daily:${userId}:${today}`;
}

/**
 * 無料利用回数を1消費する。上限に達している場合は false を返す。
 * カウント粒度は「質問単位で合算5回」(CL4要件参照)。
 */
export async function consumeDailyFreeQuota(
  userId: string,
  limit: number = DAILY_FREE_LIMIT
): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const key = todayKey(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    // 初回のみTTLを設定(日付が変わったら自動リセット)
    await redis.expire(key, 60 * 60 * 26); // 26時間(タイムゾーンのズレ吸収のバッファ込み)
  }
  if (count > limit) {
    // 超過分は実行されないためカウントを戻す。
    // こうしないと「無料会員で402→その後サブスク加入」の際に、
    // 402時の空振りincrが有料枠(5回)を目減りさせてしまう(2026-07-06修正)。
    const current = Number((await redis.get<number>(key)) ?? 0);
    if (current > 0) await redis.set(key, current - 1, { ex: 60 * 60 * 26 });
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - count };
}

export async function getRemainingDailyFreeQuota(
  userId: string,
  limit: number = DAILY_FREE_LIMIT
): Promise<number> {
  const key = todayKey(userId);
  const count = Number((await redis.get<number>(key)) ?? 0);
  return Math.max(0, limit - count);
}

/**
 * 無料枠の払い戻し(CEO_QUOTA_definition 2026-07-05)。
 * 「1日5回」は"糸町の少年からの返信が届いた回数"と定義されたため、
 * 消費後に生成が失敗して返信を届けられなかった場合はカウンターを1戻す。
 */
export async function refundDailyFreeQuota(userId: string): Promise<void> {
  const key = todayKey(userId);
  const count = Number((await redis.get<number>(key)) ?? 0);
  if (count > 0) {
    await redis.set(key, count - 1, { ex: 60 * 60 * 26 });
  }
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
