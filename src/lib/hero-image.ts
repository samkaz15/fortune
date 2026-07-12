/**
 * ヒーロー画像セレクタ (Gemini生成10枚対応 / 2026-07-12設計)
 *
 * 【仕組み】public/character/hero/ に置かれた10枚を、その日の診断結果(スコア)と
 * 時間帯(JST)に応じて出し分ける。選択は「日付+スコア」から決定論的に行い、
 * リロードで画像がチラチラ変わらないようにする(同じ日は同じ画像)。
 *
 * 【運用】画像はCEOがGemini APIで生成して手動配置(docs/hero_images_gemini_spec.md参照)。
 * ファイルが未配置でも壊れない: HeroImageコンポーネントがonErrorで既存の
 * report_hero.jpg へフォールバックするため、10枚は1枚ずつ追加していける。
 */

export interface HeroImageEntry {
  file: string; // public/character/hero/ 配下のファイル名
  scoreMin: number;
  scoreMax: number;
  time: "morning" | "day" | "night" | "any"; // JSTの時間帯(morning=4-10時, day=10-17時, night=17-4時)
  mood: string; // 生成指示書と対応する気分タグ(ドキュメント用)
}

/** 10枚のマニフェスト(docs/hero_images_gemini_spec.mdの生成ブリーフと1:1対応) */
export const HERO_MANIFEST: HeroImageEntry[] = [
  { file: "hero_01_sunrise_charge.png", scoreMin: 80, scoreMax: 100, time: "morning", mood: "攻めの朝" },
  { file: "hero_02_celebration_stars.png", scoreMin: 90, scoreMax: 100, time: "any", mood: "最高潮" },
  { file: "hero_03_tanabata_wish.png", scoreMin: 60, scoreMax: 89, time: "any", mood: "願いを書く" },
  { file: "hero_04_milkyway_calm.png", scoreMin: 60, scoreMax: 89, time: "night", mood: "天の川の静けさ" },
  { file: "hero_05_lantern_evening.png", scoreMin: 45, scoreMax: 79, time: "night", mood: "提灯の夕暮れ" },
  { file: "hero_06_kinshicho_bridge.png", scoreMin: 45, scoreMax: 79, time: "day", mood: "錦糸町の街" },
  { file: "hero_07_reading_scroll.png", scoreMin: 30, scoreMax: 59, time: "day", mood: "学びと準備" },
  { file: "hero_08_rain_frog.png", scoreMin: 0, scoreMax: 44, time: "day", mood: "雨宿り(慎重な日)" },
  { file: "hero_09_quiet_moon.png", scoreMin: 0, scoreMax: 44, time: "night", mood: "月夜の休息" },
  { file: "hero_10_morning_mist.png", scoreMin: 30, scoreMax: 69, time: "morning", mood: "霧の朝(仕込み)" },
];

export const HERO_FALLBACK = "/character/report_hero.jpg"; // 既存画像(未配置時の受け皿)

function timeBandOf(hourJst: number): "morning" | "day" | "night" {
  if (hourJst >= 4 && hourJst < 10) return "morning";
  if (hourJst >= 10 && hourJst < 17) return "day";
  return "night";
}

/** 文字列→安定ハッシュ(同じ日・同じスコアなら常に同じ画像を選ぶため) */
function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * ヒーロー画像を選択する。
 * @param score 当日の運勢スコア(0-100)
 * @param dateKey レポート日付(YYYY-MM-DD)。決定論のシード
 * @param now 現在時刻(省略時は現在。テスト用に注入可能)
 */
export function selectHeroImage(score: number, dateKey: string, now: Date = new Date()): string {
  const hourJst = (now.getUTCHours() + 9) % 24;
  const band = timeBandOf(hourJst);

  const inBand = HERO_MANIFEST.filter(
    (e) => score >= e.scoreMin && score <= e.scoreMax && (e.time === band || e.time === "any")
  );
  // 時間帯で絞って空ならスコアのみで再抽出、それでも空ならフォールバック
  const candidates = inBand.length > 0 ? inBand : HERO_MANIFEST.filter((e) => score >= e.scoreMin && score <= e.scoreMax);
  if (candidates.length === 0) return HERO_FALLBACK;

  const picked = candidates[hashOf(`${dateKey}:${score}`) % candidates.length];
  return `/character/hero/${picked.file}`;
}
