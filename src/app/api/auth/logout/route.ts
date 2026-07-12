import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/** POST /api/auth/logout — 認証本実装(2026-07-12): Supabaseセッション破棄+旧Cookie掃除 */
export async function POST() {
  if (isSupabaseConfigured()) {
    try {
      await createSupabaseServerClient().auth.signOut();
    } catch {
      /* セッションが既に無い場合等は無視 */
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("dev_user_id"); // レガシーCookieも常に掃除
  return res;
}
