/**
 * POST /api/love/reading { name, partnerName }
 * 恋愛特設ページのエンジン（UX6 本実装）。姓名判断で相性スコアを出し、
 * 3層構造（表層=安心 / 中層=気づき / 深層=ロック）のテキストを返す。
 * 深層（すれ違いの原因）はサブスクactiveのユーザーのみ locked=false。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { calculateCompatibilityFromNames } from "@/lib/fortune-engine/seimei";

const schema = z.object({ name: z.string().min(1).max(40), partnerName: z.string().min(1).max(40) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { name, partnerName } = parsed.data;

  // 姓名は分割できない入力もあるため、姓=全体/名=空でスコア化（相対値として一貫）
  const score = calculateCompatibilityFromNames(
    { familyName: name, givenName: "" },
    { familyName: partnerName, givenName: "" }
  );
  const closeness = Math.max(40, Math.min(99, score - 5));
  const talk = Math.max(40, Math.min(99, score + 3));
  const energy = Math.max(40, Math.min(99, score - 16));

  const userId = await getCurrentUserId();
  let subscribed = false;
  if (userId) {
    const sub = await prisma.subscription.findFirst({ where: { userId, status: "active" } });
    subscribed = Boolean(sub);
  }

  // スコア帯に応じたコメント(固定文言の矛盾を防ぐ)
  const scoreComment =
    score >= 85
      ? "数字は高めです。ただ、点数より大事なことが下にあります。"
      : score >= 65
        ? "悪くない数字です。ただ、点数より大事なことが下にあります。"
        : "数字は控えめです。でも、これは「終わり」ではなく「整理前」の数字です。";

  return NextResponse.json({
    score,
    scoreComment,
    meters: { closeness, talk, energy },
    layers: {
      surface: "今の関係は安定しているように見えますが、実はまだ「お互いの理解が揃っていない状態」です。",
      partner: "相手は安心感を持っていますが、一歩踏み込むことには少し慎重になっています。",
      flow: "この関係は自然に進む可能性もありますが、「ある小さな誤解」が進展スピードを左右しています。",
      action: "無理に動く必要はありませんが、“タイミングの選び方”だけ意識すると流れが変わります。",
      gap: "この先の関係には「進展するポイント」と「停滞するポイント」が両方存在します。",
      assist: "いまの関係は「悪い／良い」ではなく、まだ整理途中の状態です。",
      sway: "このままでも関係は続きますが、1つだけ見落としやすいポイントがあります。",
    },
    deep: subscribed
      ? {
          locked: false,
          text: `${name}さんと${partnerName}さんのすれ違いの入口は、日常の「言わなくても分かるだろう」の積み重ねの中にあります。次にふたりの空気が緩む週後半、${name}さんから軽い一言を渡すのが転換点になります。`,
        }
      : { locked: true, cta: "関係の本質を確認する", note: "※見えている部分は全体の一部です" },
  });
}
