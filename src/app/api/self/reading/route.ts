/**
 * POST /api/self/reading { name, birthDate }
 * 「自分のこと」診断(UI仕様v5)。四柱推命+解釈辞書(Core Mapping Spec)で
 * ①状態②傾向③注意1つ④行動1つ の絶対固定フォーマットを返す。
 * 深掘り(今の流れ・今後の転機)はサブスク限定でロック。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { calculateShichu } from "@/lib/fortune-engine/shichu";
import { interpretDayStem, fiveElementAdjustment } from "@/lib/fortune-engine/interpretation-dictionary";
import { deriveSanmeiProfile } from "@/lib/fortune-engine/sanmei-dictionary";

const schema = z.object({
  name: z.string().min(1).max(40),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { name, birthDate } = parsed.data;
  const bd = new Date(birthDate + "T00:00:00");

  const shichu = calculateShichu(bd);
  const stem = interpretDayStem(shichu.dayStem);
  const sanmei = deriveSanmeiProfile(bd);

  const userId = await getCurrentUserId();
  let subscribed = false;
  if (userId) {
    subscribed = Boolean(await prisma.subscription.findFirst({ where: { userId, status: "active" } }));
  }

  return NextResponse.json({
    name,
    // ① 現在の状態 ② 性質の傾向 ③ 注意点(1つ) ④ 行動(1つだけ)
    state: `いまの${name}さんは「${stem.state}」の流れです。`,
    tendency: `${stem.description} ${sanmei.star.core}`,
    caution: sanmei.star.stress_factors[0] ?? "予定を詰め込みすぎること",
    action: stem.action,
    elementNote: fiveElementAdjustment[shichu.element] ?? null,
    wave: shichu.wave,
    deep: subscribed
      ? {
          locked: false,
          behaviors: sanmei.star.behaviors,
          ngEnvironment: sanmei.star.ng_environment,
        }
      : { locked: true },
  });
}
