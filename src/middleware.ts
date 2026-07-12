import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 認証本実装(2026-07-12): Supabaseセッションの更新をmiddlewareで行う。
 *
 * - 本番(SUPABASE設定あり): リクエスト毎に supabase.auth.getUser() を呼び、
 *   期限切れ間近のアクセストークンをリフレッシュしてCookieへ書き戻す(@supabase/ssr標準パターン)。
 *   12時間アイドルタイムアウト(要件④ 2026-07-08)はSupabaseダッシュボードの
 *   Auth設定「Inactivity timeout = 12h」で実現する(docs/supabase_auth_migration.md)。
 * - 開発(SUPABASE未設定): 従来のdev_user_id Cookieのスライディング延長を維持。
 * - どちらのモードでも、未ログインで保護ページへ来たら /auth/login へリダイレクト。
 */

const SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12時間(devフォールバック用)

/** 未ログイン時にログイン画面へ遷移させる、ログイン必須ページ */
const PROTECTED_PAGES = ["/mypage"];

function redirectToLogin(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  if (PROTECTED_PAGES.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ---------- 本番: Supabaseセッション更新 ----------
  if (supabaseUrl && supabaseKey) {
    let res = NextResponse.next({ request: req });
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });

    // getUser()がトークンの検証とリフレッシュを行う(結果のCookieはsetAll経由でresへ)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const redirect = redirectToLogin(req);
      if (redirect) return redirect;
    }
    return res;
  }

  // ---------- 開発フォールバック: dev_user_id スライディング延長 ----------
  const session = req.cookies.get("dev_user_id")?.value;
  if (!session) {
    return redirectToLogin(req) ?? NextResponse.next();
  }
  const res = NextResponse.next();
  res.cookies.set("dev_user_id", session, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return res;
}

export const config = {
  // 静的アセット・画像最適化・faviconは対象外(不要なCookie再発行を避ける)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|character).*)"],
};
