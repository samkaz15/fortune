import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

/** POST /api/auth/login — TODO: 本番はSupabase Authに置き換える。現状はCookieベースの最小実装。 */
const schema = z.object({ email: z.string().email(), password: z.string() });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const res = NextResponse.json({ userId: user.id });
  res.cookies.set("dev_user_id", user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 12, // 12時間(要件④ 2026-07-08: 無操作12時間で自動ログアウト。middlewareが操作毎に延長)
    path: "/",
  });
  return res;
}
