import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * TODO: 本番はSupabase Authに置き換える想定の暫定実装。
 * ここではnode:cryptoのscryptで最低限のパスワードハッシュ化のみ行う。
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  if (candidate.length !== original.length) return false;
  return timingSafeEqual(candidate, original);
}
