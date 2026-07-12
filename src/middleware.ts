import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 認証本実装(2026-07-12) / 2026-07-12緊急修正:
 * middleware内の例外はサイト全体を500(MIDDLEWARE_INVOCATION_FAILED)にするため、
 * Supabase処理全体をtry/catchで包み、いかなる失敗時も「素通し」に倒す(fail-open for availability)。
 * 認証の強制はサーバー側のrequireUserId/requirePlanが担っており、middlewareが素通りしても
 * 保護APIが突破されることはない(middlewareはセッション更新とUX用リダイレクトのみ)。
 *
 * - 本番(SUPABASE設定あり): セッショントークンのリフレッシュ+未ログインの保護ページリダイレクト
 * - 開発(未設定): dev_user_id Cookieのスライディング延長
 * - 12時間アイドルタイムアウトはSupabaseダッシュボード側の設定(docs/supabase_auth_migration.md)
 */

const SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12時間(devフォールバック用)
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

/** URLとして成立するSupabase URLかを事前検証(値の取り違え対策) */
function validSupabaseUrl(v: string | undefined): v is string {
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ---------- 本番: Supabaseセッション更新(全体を防御) ----------
  if (validSupabaseUrl(supabaseUrl) && supabaseKey) {
    try {
      // Next.js 14のNextResponse.nextはrequestオプションに{headers}を取る形が安全
      let res = NextResponse.next({ request: { headers: req.headers } });
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            res = NextResponse.next({ request: { headers: req.headers } });
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const redirect = redirectToLogin(req);
        if (redirect) return redirect;
      }
      return res;
    } catch (e) {
      // 設定不備・Supabase側障害等。落とさずに素通しし、ログにだけ残す
      console.error("[middleware] supabase session refresh failed:", e);
      return NextResponse.next();
    }
  }

  // ---------- 開発フォールバック: dev_user_id スライディング延長 ----------
  try {
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
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|character).*)"],
};
