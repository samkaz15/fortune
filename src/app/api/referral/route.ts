import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

/**
 * GET /api/referral — 自分の招待コードと実績を取得(未発行なら発行する)
 *
 * CL20: 紹介制度。報酬設計(暫定・要CEO確認):
 *   招待した側: 被招待者が初回診断を完了した時点で 1ポイント(=質問1回分) 付与
 *   招待された側: 登録時に 1ポイント 付与
 * 付与処理は signup API(/api/auth/signup)側で referralCode を受けた時に行う。
 */
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }

  let user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.referralCode) {
    // 8文字の英数コード(視認性の悪い文字 0/O/1/l は避ける)
    const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
    const bytes = randomBytes(8);
    const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    user = await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  }

  const invitedCount = await prisma.user.count({ where: { referredByUserId: userId } });
  const pointBalance = await prisma.pointBalance.findUnique({ where: { userId } });

  return NextResponse.json({
    referralCode: user.referralCode,
    inviteUrl: `${process.env.APP_URL ?? ""}/invite/${user.referralCode}`,
    invitedCount,
    pointBalance: pointBalance?.balance ?? 0,
  });
}
