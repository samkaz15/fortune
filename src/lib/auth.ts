import { cookies } from "next/headers";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * 認証本実装 (2026-07-12): Supabase Auth ベース。
 * - 本番: SupabaseのCookieセッションからauthユーザーを取得し、User.authIdで自社Userに解決する
 * - 開発: SUPABASE環境変数が未設定なら従来のdev_user_id Cookieにフォールバック
 *   (dev_user_id方式は本番では機能しない=偽装Cookieを渡されてもSupabase側で無視される)
 * - authIdでUserが見つからない場合はemailで探して authId をバックフィル
 *   (レガシーユーザーの遅延移行。docs/supabase_auth_migration.md 参照)
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    const devUserId = cookies().get("dev_user_id")?.value;
    return devUserId ?? null;
  }
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser(); // Cookieのアクセストークンをサーバー側で検証
    if (!authUser) return null;

    const byAuthId = await prisma.user.findUnique({ where: { authId: authUser.id }, select: { id: true } });
    if (byAuthId) return byAuthId.id;

    // レガシーユーザー: email一致でauthIdをバックフィルして紐付ける
    if (authUser.email) {
      const byEmail = await prisma.user.findUnique({ where: { email: authUser.email }, select: { id: true, authId: true } });
      if (byEmail && !byEmail.authId) {
        await prisma.user.update({ where: { id: byEmail.id }, data: { authId: authUser.id } });
        return byEmail.id;
      }
    }
    return null; // auth上には居るが自社Userが無い(サインアップ途中で中断等)。signup完了を促す
  } catch {
    return null; // fail-closed: 検証できないセッションはゲスト扱い
  }
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

// ---------------- プラン判定 (AI人生コンパス Step1 / 2026-07-12) ----------------

import { prisma } from "@/lib/db";

export type UserPlan = "guest" | "member" | "paid";

/**
 * プラン判定の単一窓口。
 * - guest : 未ログイン(userIdなし) or Userレコードなし(Cookie偽装・退会済みを弾く)
 * - member: 登録済みだが有効なサブスクなし
 * - paid  : Subscription.status === "active"
 *
 * 【運用ルール】各APIは prisma.subscription を直接見ず、必ずこの関数を経由すること。
 * 課金判定の仕様変更(トライアル・grace period等)をここ1箇所に閉じ込めるため。
 * 認証がSupabase Authへ移行しても、この関数のシグネチャは変えない。
 */
export async function getUserPlan(userId: string | null | undefined): Promise<UserPlan> {
  if (!userId) return "guest";
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        deletedAt: true,
        subscription: { select: { status: true } },
      },
    });
    if (!user || user.deletedAt) return "guest"; // 存在しないID・論理削除済みはguest扱い(なりすまし対策)
    return user.subscription?.status === "active" ? "paid" : "member";
  } catch {
    // DB不調時は最も権限の低い判定に倒す(fail-closed)
    return userId ? "member" : "guest";
  }
}

/** 現在のセッションからプランを判定するショートカット */
export async function getCurrentUserPlan(): Promise<{ userId: string | null; plan: UserPlan }> {
  const userId = await getCurrentUserId();
  return { userId, plan: await getUserPlan(userId) };
}

export class PlanRequiredError extends Error {
  constructor(public readonly required: UserPlan, public readonly actual: UserPlan) {
    super(required === "paid" ? "有料プランへの登録が必要です" : "ログインが必要です");
    this.name = "PlanRequiredError";
  }
}

/**
 * プラン制限ガード。APIルート冒頭で
 *   const { userId } = await requirePlan("paid");
 * のように使う。要件を満たさない場合は PlanRequiredError を投げる
 * (ルート側で 401/402 に変換する。AuthRequiredError と同じハンドリングパターン)。
 */
export async function requirePlan(required: Exclude<UserPlan, "guest">): Promise<{ userId: string; plan: UserPlan }> {
  const { userId, plan } = await getCurrentUserPlan();
  const rank: Record<UserPlan, number> = { guest: 0, member: 1, paid: 2 };
  if (!userId || rank[plan] < rank[required]) {
    throw new PlanRequiredError(required, plan);
  }
  return { userId, plan };
}
