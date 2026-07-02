/**
 * 算命学（簡易実装・ビジネス占い特化）
 *
 * 依頼要件(入力テンプレ⑧)の再現:
 * 「その人が今の社会人生活の中で出世を目指すべきか／どんな力を持っているか」を推測し、
 * 全員に起業を勧めるのではなく、安定志向の人には安定を、起業志向の人には
 * 何がトリガーになり得るかを、年齢的な統計も加味して伝える。
 *
 * ⚠️ 実データ未整備の暫定実装:
 * 本来の算命学は干支・十大主星・十二大従星などの複雑な命式計算が必要。
 * ここでは生年月日から決定論的な適性スコアを導出する簡易モデルで代替している。
 * → CEO占術監修(CEO1)で正式な命式計算に差し替えることを推奨する。
 */

export type CareerOrientation = "stability" | "entrepreneurial" | "hybrid";

export interface SanmeiSummary {
  orientation: CareerOrientation;
  stabilityScore: number; // 0-100
  entrepreneurialScore: number; // 0-100
  ageStage: "20代" | "30代" | "40代" | "50代以上";
  trigger: string; // 起業/転機のトリガーになりやすい要素
  advice: string;
}

function ageStageOf(birthDate: Date): SanmeiSummary["ageStage"] {
  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 30) return "20代";
  if (age < 40) return "30代";
  if (age < 50) return "40代";
  return "50代以上";
}

export function calculateSanmei(birthDate: Date): SanmeiSummary {
  const seed = birthDate.getFullYear() * 372 + (birthDate.getMonth() + 1) * 31 + birthDate.getDate();
  const stabilityScore = 40 + (seed % 61); // 40-100
  const entrepreneurialScore = 40 + ((seed * 7) % 61);

  let orientation: CareerOrientation = "hybrid";
  if (stabilityScore - entrepreneurialScore > 15) orientation = "stability";
  else if (entrepreneurialScore - stabilityScore > 15) orientation = "entrepreneurial";

  const ageStage = ageStageOf(birthDate);

  const triggerByOrientation: Record<CareerOrientation, string> = {
    stability:
      "安定した環境の中で専門性を積み上げることが最大の武器。転職より社内での役割拡大が向いている",
    entrepreneurial:
      "『任される』より『任せてもらえない』ことがストレスになりやすい人。信頼できる相棒との出会いが起業のトリガーになりやすい",
    hybrid:
      "安定基盤を持ちながら副業的に挑戦する『二刀流』が最も力を発揮しやすいタイプ",
  };

  const adviceByAgeStage: Record<SanmeiSummary["ageStage"], string> = {
    "20代": "まずは会社の中で圧倒的な実績を作る時期。焦って独立するより、信用の土台を作ることを優先すると良い",
    "30代": "自分の得意分野が固まってくる時期。役割を広げるか、専門特化するかの選択が今後の分岐点になる",
    "40代": "これまでの経験を『誰かに教える・任せる』方向に転換すると新しい道が開けやすい",
    "50代以上": "積み上げてきた信頼を、次の世代や新しい挑戦にどう還元するかが運気の鍵になる",
  };

  return {
    orientation,
    stabilityScore,
    entrepreneurialScore,
    ageStage,
    trigger: triggerByOrientation[orientation],
    advice: adviceByAgeStage[ageStage],
  };
}
