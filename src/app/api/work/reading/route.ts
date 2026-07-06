/**
 * POST /api/work/reading  { name, birthDate, situation }
 * 仕事特設ページのエンジン（UX7 本実装）。
 *
 * - 算命学(sanmei-dictionary)で本質の型を導出
 * - 無料部分: 本質＋中長期の流れ＋今日の行動（部分開示）
 * - 有料部分: 将来相性の「業界×部署」まで特定（fitJobs）。
 *   認証+サブスク(active)がある場合のみ locked=false で中身を返す。
 *
 * 星名など占術用語はレスポンスに含めない（UI非開示の原則）。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { deriveSanmeiProfile } from "@/lib/fortune-engine/sanmei-dictionary";
import { calculateShichu } from "@/lib/fortune-engine/shichu";
import { interpretDayStem } from "@/lib/fortune-engine/interpretation-dictionary";

const schema = z.object({
  name: z.string().min(1).max(40),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  situation: z.enum(["うまくいっている", "少し疲れている", "判断に迷っている", "環境を変えたい"]),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { name, birthDate, situation } = parsed.data;

  const bd = new Date(birthDate + "T00:00:00");
  const profile = deriveSanmeiProfile(bd);
  const shichu = calculateShichu(bd);
  const stemState = interpretDayStem(shichu.dayStem);

  // 本質(星のcore/behaviorsを占術用語なしの言葉へ)
  const essence = {
    core: profile.star.core,
    behaviors: profile.star.behaviors.slice(0, 3),
    stress: profile.star.stress_factors[0] ?? null,
    ngEnvironment: profile.star.ng_environment,
  };

  // 中長期の流れ(状態→行動の辞書 + 現在状況)
  const midTermBySituation: Record<string, string> = {
    うまくいっている: "いまは積み上げが素直に伸びる時期。攻めるより、伸びている線をそのまま太くするのが効きます。",
    少し疲れている: "消耗は量より「判断の多さ」から来ています。いまは動く時期ではなく整える時期の後半です。",
    判断に迷っている: "迷いは決断力の問題ではなく、材料が揃っていないだけ。整理が進めば流れは自然に決まります。",
    環境を変えたい: "変えたい気持ちは自然な転換のサイン。ただ、いまの蓄積を持って動くと立ち上がりが速くなります。",
  };

  // 有料判定: サブスクactiveか
  const userId = await getCurrentUserId();
  let subscribed = false;
  if (userId) {
    const sub = await prisma.subscription.findFirst({ where: { userId, status: "active" } });
    subscribed = Boolean(sub);
  }

  // 有料コンテンツ: 業界×部署の相性(fitJobs)
  const future = subscribed
    ? {
        locked: false,
        fitJobs: profile.fitJobs.map((j) => ({
          industry: j.industry,
          department: j.department,
          grade: j.grade,
        })),
        message:
          profile.fitJobs.length > 0
            ? `${name}さんの型がいちばん活きるのは、${profile.fitJobs
                .slice(0, 2)
                .map((j) => `${j.industry}の${j.department}`)
                .join("、")}あたりです。`
            : "業界より、役割の選び方で伸びるタイプです。",
      }
    : {
        locked: true,
        preview: "将来的に相性のいい業界と、その中の部署・役割まで特定できています。",
        cta: "仕事の転換点を確認する",
      };

  return NextResponse.json({
    name,
    situation,
    essence,
    stemAction: stemState.action,
    midTerm: midTermBySituation[situation],
    future,
  });
}
