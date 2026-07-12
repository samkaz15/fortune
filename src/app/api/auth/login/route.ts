import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSupabaseServerClient, createSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * POST /api/auth/login — 認証本実装(2026-07-12)
 * 本番: Supabase Auth(signInWithPassword)。セッションCookieはSDKが設定する。
 * レガシーユーザーの遅延移行: 旧Cookie認証時代のユーザー(authIdなし・passwordHashあり)は
 *   Supabase上にアカウントが無いためsignInに失敗する。その場合、旧ハッシュで検証し、
 *   一致すればAdmin APIでSupabaseユーザーを作成→authIdを紐付け→再signInする。
 *   (SUPABASE_SERVICE_ROLE_KEY未設定の場合はパスワード再設定を案内するエラーを返す)
 * 開発: SUPABASE環境変数が未設定なら従来のdev_user_id Cookie方式。
 */
const schema = z.object({ email: z.string().email(), password: z.string() });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // ---------- 開発フォールバック(Supabase未設定) ----------
  if (!isSupabaseConfigured()) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const res = NextResponse.json({ userId: user.id });
    res.cookies.set("dev_user_id", user.id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 12, // 12時間(要件④ 2026-07-08)
      path: "/",
    });
    return res;
  }

  // ---------- 本番: Supabase Auth ----------
  const supabase = createSupabaseServerClient();
  const first = await supabase.auth.signInWithPassword({ email, password });

  if (!first.error && first.data.user) {
    const userId = await ensureLinkedUser(first.data.user.id, email);
    if (!userId) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ userId });
  }

  // signIn失敗 → レガシーユーザーの遅延移行を試みる
  const legacy = await prisma.user.findUnique({ where: { email } });
  const isLegacy = legacy && !legacy.authId && legacy.passwordHash && verifyPassword(password, legacy.passwordHash);
  if (!isLegacy) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    // 移行手段がない環境: パスワード再設定フローへ誘導
    return NextResponse.json({ error: "LEGACY_MIGRATION_REQUIRED" }, { status: 409 });
  }

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    return NextResponse.json({ error: "AUTH_MIGRATION_FAILED", detail: created.error?.message }, { status: 500 });
  }
  await prisma.user.update({ where: { id: legacy.id }, data: { authId: created.data.user.id, passwordHash: null } });

  const second = await supabase.auth.signInWithPassword({ email, password });
  if (second.error || !second.data.user) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  return NextResponse.json({ userId: legacy.id, migrated: true });
}

/** authIdで自社Userを解決。無ければemailでバックフィル(auth.tsと同じ遅延紐付け) */
async function ensureLinkedUser(authId: string, email: string): Promise<string | null> {
  const byAuthId = await prisma.user.findUnique({ where: { authId }, select: { id: true } });
  if (byAuthId) return byAuthId.id;
  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true, authId: true } });
  if (byEmail && !byEmail.authId) {
    await prisma.user.update({ where: { id: byEmail.id }, data: { authId } });
    return byEmail.id;
  }
  return byEmail?.id ?? null;
}
