/**
 * Supabase Auth クライアント基盤 (認証本実装 / 2026-07-12)
 *
 * - createSupabaseServerClient: Server Component / Route Handler 用(Cookieセッション)
 * - createSupabaseAdmin: サーバー専用の管理クライアント(レガシーユーザーの遅延移行に使用)
 * - isSupabaseConfigured: 環境変数が未設定の開発環境では従来のdev_user_id Cookieに
 *   フォールバックするための判定(auth.ts側で分岐)
 *
 * セッションポリシー: 12時間アイドルタイムアウト(要件④ 2026-07-08)は
 * SupabaseダッシュボードのAuth設定「Time-box user sessions / Inactivity timeout」で
 * 12時間に設定すること(docs/supabase_auth_migration.md 参照)。
 */
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Route Handler / Server Component から呼ぶ。Cookieのセッションを読み書きする */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Componentからの呼び出しではCookieを書けない(読み取り専用)。
            // セッション更新はmiddleware側が担うため、ここでの失敗は無視してよい。
          }
        },
      },
    }
  );
}

/**
 * 管理クライアント(SERVICE_ROLE)。ユーザーのセッションを持たず、Auth Admin APIを叩ける。
 * 用途はレガシーユーザーの遅延移行(login route)に限定すること。未設定ならnull。
 */
export function createSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
