/**
 * POST /api/self/reading { name, birthDate, lat?, lon? }
 * 「自分のこと」総合鑑定(要件⑤ 2026-07-08で全面刷新)。
 * 4占術(四柱推命・算命学・ホロスコープ・姓名判断)+天気(気圧)を統合した
 * 10セクション(本質/現在の運勢/恋愛運/仕事運/金運/健康運/人間関係/未来/行動指針/締め)を返す。
 * 深掘り(行動特性・合わない環境)はサブスク限定ロック(既存ペイウォール仕様を維持)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { generateFreeReading } from "@/lib/free-reading";
import { getWeatherContext } from "@/lib/weather";

const schema = z.object({
  name: z.string().min(1).max(40),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // 位置情報は任意(拒否されても鑑定は生成される)。天気→コンディション反映に使う
  lat: z.number().optional(),
  lon: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { name, birthDate, lat, lon } = parsed.data;
  const bd = new Date(birthDate + "T00:00:00");

  const weather = lat !== undefined && lon !== undefined ? await getWeatherContext(lat, lon) : null;

  const [reading, userId] = await Promise.all([
    generateFreeReading({ name, birthDate: bd, weather }),
    getCurrentUserId(),
  ]);

  let subscribed = false;
  if (userId) {
    subscribed = Boolean(await prisma.subscription.findFirst({ where: { userId, status: "active" } }));
  }

  // 3段階の出し分け(2026-07-08是正。従来は非登録と登録会員が完全同一で登録メリットがゼロだった):
  //   非登録    = 01〜04(本質/現在の運勢/恋愛運/仕事運)のみ。続きは会員登録で解放
  //   登録会員  = 全10セクション
  //   有料会員  = +深掘り(行動特性・合わない環境)
  // ロック分はサーバー側で送信しない(クライアント側の目隠しではなく本当に渡さない)
  const tier: "guest" | "member" | "paid" = !userId ? "guest" : subscribed ? "paid" : "member";
  const { essence, currentFortune, love, work, ...memberSections } = reading.sections;
  const sections = tier === "guest" ? { essence, currentFortune, love, work } : reading.sections;
  void memberSections;

  return NextResponse.json({
    name,
    tier,
    grounding: reading.grounding, // 占術根拠は全段階に開放(信頼性訴求のため非登録者にも見せる)
    sections,
    memberLocked: tier === "guest", // 05〜10が未開放(登録で解放)
    wave: reading.wave,
    elementNote: reading.elementNote,
    deep:
      tier === "paid"
        ? { locked: false, behaviors: reading.deepMaterial.behaviors, ngEnvironment: reading.deepMaterial.ngEnvironment }
        : { locked: true },
  });
}
