import { cookies } from "next/headers";

/**
 * 認証は Supabase Auth を想定した最小スタブ。
 * TODO: @supabase/ssr を導入し、Cookieベースのセッション検証に差し替える。
 * 現状は開発用に Cookie "dev_user_id" があればそれをユーザーIDとして扱う。
 */
export async function getCurrentUserId(): Promise<string | null> {
  const store = cookies();
  const devUserId = store.get("dev_user_id")?.value;
  return devUserId ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new AuthRequiredError();
  }
  return userId;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("ログインが必要です");
    this.name = "AuthRequiredError";
  }
}
