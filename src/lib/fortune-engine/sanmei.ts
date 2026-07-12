/**
 * 算命学(案B: 四柱推命エンジン連動・高尾学館系の一般理論ベース) — D-11 2026-07-12
 *
 * CEO決定(2026-07-12): 案B採用。独自の命式フルスクラッチではなく、
 * 四柱エンジン(shichu/setsuiri)の干支から通変星・十二運を求め、
 * 高尾学館系で一般に用いられる十大主星・十二大従星へ対応づけて導出する。
 * 星の意味・適性の知識ベースは prompts/analysis/sanmei_index.v1.json(監修対象)。
 *
 * 導出規則(要監修確認):
 * - 主星(本質の型)= 日干×月干の通変星 → 十大主星(月干=社会面の自分)
 * - 年干星(土台の型)= 日干×年干の通変星 → 十大主星
 * - 日々のエネルギー体質 = 日干×日支の十二運 → 十二大従星
 * ※蔵干を用いた人体星図の完全再現はPhase2(監修者と対照表確定後)。
 *
 * 旧実装(生年月日seedによる擬似スコア)は全廃した。
 */
import { calculateFourPillars } from "./shichu";
import { shuseiOf, juuseiOf } from "./tsuhensei";

export type CareerOrientation = "stability" | "entrepreneurial" | "hybrid";

export interface SanmeiSummary {
  orientation: CareerOrientation;
  stabilityScore: number; // 0-100
  entrepreneurialScore: number; // 0-100
  ageStage: "20代" | "30代" | "40代" | "50代以上";
  trigger: string; // 起業/転機のトリガーになりやすい要素
  advice: string;
  /** 案B(命式ベース)追加フィールド */
  mainStar: string; // 主星(日干×月干)
  yearStar: string; // 年干星(日干×年干)
  dayJuusei: string; // 日々のエネルギー体質(日干×日支)
}

/**
 * 主星ごとのキャリア指向の重み(要監修レビュー)。
 * 一般理論での性質から設定: 貫索=独立独歩 / 石門=横のつながり / 鳳閣=自然体の伝達 /
 * 調舒=独自性・完璧主義 / 禄存=人望・奉仕 / 司禄=蓄積・堅実 / 車騎=即行動 /
 * 牽牛=組織・肩書 / 龍高=改革・放浪 / 玉堂=学び・理論
 */
const STAR_WEIGHTS: Record<string, { stability: number; entrepreneurial: number }> = {
  貫索星: { stability: 4, entrepreneurial: 14 },
  石門星: { stability: 8, entrepreneurial: 10 },
  鳳閣星: { stability: 10, entrepreneurial: 6 },
  調舒星: { stability: 2, entrepreneurial: 12 },
  禄存星: { stability: 10, entrepreneurial: 8 },
  司禄星: { stability: 16, entrepreneurial: 0 },
  車騎星: { stability: 4, entrepreneurial: 12 },
  牽牛星: { stability: 15, entrepreneurial: 2 },
  龍高星: { stability: 0, entrepreneurial: 16 },
  玉堂星: { stability: 13, entrepreneurial: 3 },
};

/** 主星ごとの転機トリガー(知識ベースの性質から要約。文言は監修・ライティング調整可) */
const STAR_TRIGGERS: Record<string, string> = {
  貫索星: "裁量を奪われた瞬間に火がつく型。『自分の城』を持てる環境への移行が転機になる",
  石門星: "一人の実力より『誰と組むか』で伸びる型。信頼できる仲間との出会いが転機になる",
  鳳閣星: "楽しめているかが成果に直結する型。発信・表現の場を得ることが転機になる",
  調舒星: "量産や画一化がストレスになる型。独自性を評価してくれる場への移動が転機になる",
  禄存星: "人に求められることで回転が上がる型。『ありがとう』が集まる役回りが転機になる",
  司禄星: "積み上げが裏切らない型。転職より、今いる場所での信用の複利が転機になる",
  車騎星: "考えるより動いて摑む型。迷ったら小さく即実行することが転機になる",
  牽牛星: "肩書と責任が力に変わる型。役職・資格など『看板』を取りに行くことが転機になる",
  龍高星: "現状維持が最大のリスクになる型。環境ごと変える(移動・学び直し)ことが転機になる",
  玉堂星: "学びが武器になる型。専門知の深掘りと、それを教える側に回ることが転機になる",
};

function ageStageOf(birthDate: Date): SanmeiSummary["ageStage"] {
  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 30) return "20代";
  if (age < 40) return "30代";
  if (age < 50) return "40代";
  return "50代以上";
}

const ADVICE_BY_AGE: Record<SanmeiSummary["ageStage"], string> = {
  "20代": "まずは今の場所で圧倒的な実績を一つ作る時期。信用の土台が、後のすべての選択肢を増やす",
  "30代": "得意分野が固まる時期。役割を広げるか専門特化するか、ここでの選択が10年の分岐点になる",
  "40代": "これまでの経験を『教える・任せる』方向へ転換すると次の道が開く",
  "50代以上": "積み上げた信頼を、次の世代と新しい挑戦にどう還元するかが運気の鍵になる",
};

/**
 * 生年月日(+任意で出生時間)から算命学サマリを導出する。
 * 出生時間は主星の導出には不要だが、節入り当日生まれの月柱精度に効く。
 */
export function calculateSanmei(birthDate: Date, birthTime?: string | null): SanmeiSummary {
  const fp = calculateFourPillars(birthDate, birthTime);
  const dayStem = fp.day.index % 10;

  const mainStar = shuseiOf(dayStem, fp.month.index % 10);
  const yearStar = shuseiOf(dayStem, fp.year.index % 10);
  const dayJuusei = juuseiOf(dayStem, fp.day.index % 12);

  // 指向スコア: 主星(社会面)を2倍、年干星(土台)を1倍で重み付け
  const w1 = STAR_WEIGHTS[mainStar] ?? { stability: 8, entrepreneurial: 8 };
  const w2 = STAR_WEIGHTS[yearStar] ?? { stability: 8, entrepreneurial: 8 };
  const stabilityScore = Math.min(100, 40 + w1.stability * 2 + w2.stability);
  const entrepreneurialScore = Math.min(100, 40 + w1.entrepreneurial * 2 + w2.entrepreneurial);

  let orientation: CareerOrientation = "hybrid";
  if (stabilityScore - entrepreneurialScore > 12) orientation = "stability";
  else if (entrepreneurialScore - stabilityScore > 12) orientation = "entrepreneurial";

  const ageStage = ageStageOf(birthDate);

  return {
    orientation,
    stabilityScore,
    entrepreneurialScore,
    ageStage,
    trigger: STAR_TRIGGERS[mainStar] ?? STAR_TRIGGERS["司禄星"],
    advice: ADVICE_BY_AGE[ageStage],
    mainStar,
    yearStar,
    dayJuusei,
  };
}
