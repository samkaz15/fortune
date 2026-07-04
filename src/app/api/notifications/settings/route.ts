import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

/** GET/PATCH /api/notifications/settings — 通知設定の取得・更新(CL17) */

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }

  const setting = await prisma.notificationSetting.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return NextResponse.json({
    pushEnabled: setting.pushEnabled,
    scoreThreshold: setting.scoreThreshold,
  });
}

const patchSchema = z.object({
  pushEnabled: z.boolean().optional(),
  scoreThreshold: z.number().int().min(80).max(100).optional(),
});

export async function PATCH(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const setting = await prisma.notificationSetting.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({
    pushEnabled: setting.pushEnabled,
    scoreThreshold: setting.scoreThreshold,
  });
}
