import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

/**
 * POST /api/auth/signup
 * TODO: 本番はSupabase Authに置き換える。現状はCookieベースの最小実装。
 * 画面遷移設計書「新規登録」の役割通り、生年月日・名前・性別等の初回入力もここで回収する。
 */
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  familyName: z.string().min(1),
  givenName: z.string().min(1),
  birthDate: z.string(), // ISO date (YYYY-MM-DD)
  birthTime: z.string().optional(),
  gender: z.enum(["male", "female", "other", "unspecified"]).default("unspecified"),
  displayName: z.string().min(1).max(20),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, familyName, givenName, birthDate, birthTime, gender, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      profile: {
        create: {
          name: `${familyName}${givenName}`,
          birthDate: new Date(birthDate),
          birthTime,
          gender,
          displayName,
        },
      },
      creditBalance: { create: { balance: 0 } },
      notifications: { create: {} },
    },
  });

  const res = NextResponse.json({ userId: user.id });
  res.cookies.set("dev_user_id", user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
