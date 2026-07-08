import { NextRequest, NextResponse } from "next/server";

/**
 * 12時間スライディングセッション(要件④ 2026-07-08。旧「24時間固定」CEO要求7/7を上書き)。
 *
 * 現在の認証はCookie(dev_user_id)ベースのため、Cookieの有効期限で実現する:
 * - 操作(リクエスト)のたびに有効期限を12時間先へ延長する(スライディング)
 * - 12時間操作が無ければCookieが失効=自動ログアウト
 * - 失効後にログイン必須ページへアクセスした場合はログイン画面へ遷移
 *
 * Supabase Auth移行時は、この方針(12hアイドルタイムアウト)をセッション設定側で引き継ぐこと。
 */

const SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12時間

/** Cookie失効時にログイン画面へ遷移させる、ログイン必須ページ */
const PROTECTED_PAGES = ["/mypage"];

export function middleware(req: NextRequest) {
  const session = req.cookies.get("dev_user_id")?.value;

  if (!session) {
    const path = req.nextUrl.pathname;
    if (PROTECTED_PAGES.some((p) => path === p || path.startsWith(p + "/"))) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 操作があるたびに期限を12時間先へ延長(スライディング)
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
