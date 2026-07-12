import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlan, PlanRequiredError, AuthRequiredError } from "@/lib/auth";
import { businessPartnerCompatibility } from "@/lib/business-fortune";

/**
 * POST /api/business/partner — ビジネスパートナー相性(GM9「完全空白地帯」 / 2026-07-12)
 * body: { partnerBirthDate: "YYYY-MM-DD", partnerName?: "姓 名" }
 * member: スコア+力学の型のみ / paid: 強み・注意点・占術根拠まで全文
 */
const schema = z.object({
  partnerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partnerName: z.string().max(30).optional(),
});

export async function POST(req: NextRequest) {
  let userId: string;
  let plan: string;
  try {
    const r = await requirePlan("member");
    userId = r.userId;
    plan = r.plan;
  } catch (e) {
    if (e instanceof PlanRequiredError || e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });

  const myName = profile.name.trim().split(/[\s　]+/);
  const partnerName = parsed.data.partnerName?.trim().split(/[\s　]+/) ?? [];

  const result = businessPartnerCompatibility({
    myBirthDate: profile.birthDate,
    myFamilyName: myName[0],
    myGivenName: myName[1] ?? myName[0],
    partnerBirthDate: new Date(parsed.data.partnerBirthDate + "T00:00:00Z"),
    partnerFamilyName: partnerName[0] ?? null,
    partnerGivenName: partnerName[1] ?? partnerName[0] ?? null,
  });

  if (plan !== "paid") {
    return NextResponse.json({ plan, score: result.score, dynamics: result.dynamics, locked: true });
  }
  return NextResponse.json({ plan, ...result, locked: false });
}
