import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

/**
 * PATCH /api/profile — プロフィール属性の部分更新(2026-07-12)
 * birthTime / gender を更新できる(時柱・紫微斗数・大運の精度向上用。マイページの設定UIから使う想定)。
 * name / birthDate の変更は既存フロー(report/today)を維持。
 */
const schema = z.object({
  birthTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  gender: z.enum(["male", "female", "other", "unspecified"]).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (!existing) return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });

  const updated = await prisma.userProfile.update({
    where: { userId },
    data: parsed.data,
    select: { birthTime: true, gender: true },
  });
  return NextResponse.json(updated);
}
