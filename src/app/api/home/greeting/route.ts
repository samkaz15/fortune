/**
 * GET /api/home/greeting?lat=..&lon=..
 * ホーム挨拶の3軸スコアリング（UX5 本実装）。
 *
 * 軸1 = 天気(気圧)由来の体調スコア -10〜+10（低気圧=マイナス）
 * 軸2 = 四柱推命の日運スコア -10〜+10（本人の日柱×今日の相対評価）
 * 軸3 = 総合(軸1+軸2)
 * → 組み合わせで挨拶文を出し分ける。認証なしでも動く（体調軸のみ/挨拶は汎用）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { getWeatherContext } from "@/lib/weather";
import { calculateShichu } from "@/lib/fortune-engine/shichu";

export const dynamic = "force-dynamic";

// 気圧(hPa) → 体調スコア(-10〜+10)。標準1013で0、低いほどマイナス。
function weatherScore(pressureHpa: number): number {
  const s = Math.round((pressureHpa - 1013) * 1.2);
  return Math.max(-10, Math.min(10, s));
}

// 四柱の「今日の運気の波」(0-100) → 日運スコア(-10〜+10)
function shichuScore(birthDate: Date): number {
  const s = calculateShichu(birthDate, new Date(), "day"); // 明示的に日運(日柱)で計算
  return Math.max(-10, Math.min(10, Math.round((s.wave - 55) / 4.5)));
}

export async function GET(req: NextRequest) {
  let lat = Number(req.nextUrl.searchParams.get("lat") ?? 35.68);
  let lon = Number(req.nextUrl.searchParams.get("lon") ?? 139.76);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    lat = 35.68;
    lon = 139.76;
  }

  const weather = await getWeatherContext(lat, lon);
  const wScore = weather ? weatherScore(weather.pressureHpa) : 0;

  let sScore = 0;
  const userId = await getCurrentUserId();
  if (userId) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { birthDate: true },
    });
    if (profile) sScore = shichuScore(profile.birthDate);
  }

  const total = wScore + sScore;
  let greeting: string;
  if (total <= -8) greeting = "大丈夫？今日も聞いてください！";
  else if (wScore >= 4 && sScore <= -4) greeting = "空回りしなかった？";
  else if (wScore <= -4 && sScore >= 4) greeting = "身体は重いけど、流れは来てます";
  else if (total >= 10) greeting = "今日、かなり良さそうだね！";
  else if (total >= 3) greeting = "今日は、元気そうだね！";
  else greeting = "今日は、ぼちぼちでいこうか。";

  // スコアの内訳(軸の値)は非開示原則に従いレスポンスに含めない(挨拶文のみ返す)
  return NextResponse.json({ greeting });
}
