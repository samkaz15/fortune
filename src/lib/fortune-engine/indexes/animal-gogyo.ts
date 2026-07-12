/**
 * 動物アーキタイプ + 五行バランス(東洋思想) (マルチインデックス拡張 / 2026-07-12)
 *
 * 【動物アーキタイプ】
 * 日干×日支の十二運(shichu/tsuhensei系エンジン)から12の動物キャラクターへ対応づける
 * 独自実装。⚠️ 「動物占い®」は個性心理學研究所の登録商標・独自コンテンツのため、
 * その名称・キャラクター・変換表は一切使用しない(サービス表記は「12アニマル診断」等の
 * 独自名称を使うこと — 表記はCEO確認事項)。
 * 対応づけの根拠: 十二運はエネルギーの生育段階(誕生→成長→全盛→衰退→再生)を表すため、
 * 各段階の性質に合う動物像を独自に割り当てた(要監修・要ライティング調整)。
 *
 * 【五行バランス(東洋思想)】
 * 四柱(年月日+任意で時)の干支から木火土金水の分布を数え、過不足を判定する。
 * 蔵干は簡易実装では含めない(Phase2・要監修)。
 */
import { calculateFourPillars } from "../shichu";
import { juuniunOf, type JuuniunName } from "../tsuhensei";

// ---------------- 動物アーキタイプ ----------------

export interface AnimalResult {
  animal: string;
  stage: JuuniunName; // 由来の十二運
  keywords: string[];
}

/** 十二運→動物(独自対応。エネルギー段階の性質ベース) */
const JUUNIUN_ANIMAL: Record<JuuniunName, { animal: string; keywords: string[] }> = {
  長生: { animal: "こじか", keywords: ["純粋", "好奇心", "守られ上手"] },
  沐浴: { animal: "イルカ", keywords: ["自由", "感受性", "ムラっ気"] },
  冠帯: { animal: "クジャク", keywords: ["華", "自己演出", "社交"] },
  建禄: { animal: "ライオン", keywords: ["実力", "王道", "責任感"] },
  帝旺: { animal: "トラ", keywords: ["全盛", "統率", "堂々"] },
  衰: { animal: "ゾウ", keywords: ["円熟", "面倒見", "経験知"] },
  病: { animal: "ウサギ", keywords: ["繊細", "想像力", "空気を読む"] },
  死: { animal: "フクロウ", keywords: ["静観", "洞察", "精神性"] },
  墓: { animal: "リス", keywords: ["蓄積", "堅実", "備え"] },
  絶: { animal: "チーター", keywords: ["瞬発", "切替", "身軽"] },
  胎: { animal: "パンダ", keywords: ["可能性", "柔軟", "愛され"] },
  養: { animal: "ヒツジ", keywords: ["育み", "協調", "安心感"] },
};

export function calculateAnimal(birthDate: Date, birthTime?: string | null): AnimalResult {
  const fp = calculateFourPillars(birthDate, birthTime);
  const stage = juuniunOf(fp.day.index % 10, fp.day.index % 12);
  const entry = JUUNIUN_ANIMAL[stage];
  return { animal: entry.animal, stage, keywords: entry.keywords };
}

// ---------------- 五行バランス(東洋思想) ----------------

export interface GogyoBalance {
  counts: { 木: number; 火: number; 土: number; 金: number; 水: number };
  dominant: string; // 最多の五行
  lacking: string | null; // ゼロの五行(複数あれば最初。無ければnull)
  advice: string; // 決定論的な補い方の指針(LLM素材)
}

const STEM_ELEMENT = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"] as const;
const BRANCH_ELEMENT = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"] as const;

const LACK_ADVICE: Record<string, string> = {
  木: "成長・学び・新しい挑戦の要素を意識的に足すと巡りが整う",
  火: "表現・発信・人前に出る機会を足すと熱量が戻る",
  土: "土台づくり・習慣・住環境の安定に投資すると全体が締まる",
  金: "整理・完了・ルール化で切れ味を足すと迷いが減る",
  水: "休息・内省・情報のインプットを足すと流れが柔らかくなる",
};

export function calculateGogyoBalance(birthDate: Date, birthTime?: string | null): GogyoBalance {
  const fp = calculateFourPillars(birthDate, birthTime);
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const pillars = [fp.year, fp.month, fp.day, ...(fp.hour ? [fp.hour] : [])];
  for (const p of pillars) {
    counts[STEM_ELEMENT[p.index % 10]]++;
    counts[BRANCH_ELEMENT[p.index % 12]]++;
  }
  const entries = Object.entries(counts) as Array<[keyof typeof counts, number]>;
  const dominant = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const lackingEntry = entries.find(([, v]) => v === 0);
  const lacking = lackingEntry ? lackingEntry[0] : null;
  return {
    counts,
    dominant,
    lacking,
    advice: lacking ? LACK_ADVICE[lacking] : "五行が満遍なく揃っており、偏りの少ない設計図",
  };
}
