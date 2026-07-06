import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

/**
 * POST /api/auth/signup
 * TODO: 本番はSupabase Authに置き換える。現状はCookieベースの最小実装。
 * 画面遷移設計書「新規登録」の役割通り、生年月日・名前・性別等の初回入力もここで回収する。
 *
 * CL20: referralCode(招待コード)を任意で受け取り、有効なら
 *   - 登録者本人に 1ポイント付与(登録特典)
 *   - 招待した側に 1ポイント付与(紹介報酬)
 * を同一トランザクションで処理する。
 * 注: 本来は「被招待者の初回診断完了時」に招待側へ付与する方が不正(捨てアカウント量産)に
 * 強いが、Phase2では登録時付与のシンプル設計とし、不正対策はPhase3の課題として明記する。
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
  referralCode: z.string().optional(),
});

const REFERRAL_REWARD_POINTS = 1;

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, familyName, givenName, birthDate, birthTime, gender, displayName, referralCode } =
    parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const inviter = referralCode
    ? await prisma.user.findUnique({ where: { referralCode } })
    : null;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        referredByUserId: inviter?.id,
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
        pointBalance: { create: { balance: inviter ? REFERRAL_REWARD_POINTS : 0 } },
      },
    });

    if (inviter) {
      // 登録特典(被招待者側)の記録
      await tx.pointTransaction.create({
        data: {
          userId: created.id,
          type: "referral_reward",
          amount: REFERRAL_REWARD_POINTS,
          reason: `招待コード利用(inviter=${inviter.id})`,
        },
      });
      // 紹介報酬(招待側)
      await tx.pointBalance.upsert({
        where: { userId: inviter.id },
        create: { userId: inviter.id, balance: REFERRAL_REWARD_POINTS },
        update: { balance: { increment: REFERRAL_REWARD_POINTS } },
      });
      await tx.pointTransaction.create({
        data: {
          userId: inviter.id,
          type: "referral_reward",
          amount: REFERRAL_REWARD_POINTS,
          reason: `友達招待(referredUserId=${created.id})`,
        },
      });
    }

    return created;
  });

  const res = NextResponse.json({ userId: user.id });
  res.cookies.set("dev_user_id", user.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24時間有効(CEO要求 2026-07-07)
    path: "/",
  });
  return res;
}
