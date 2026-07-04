/**
 * 意思決定レポート ④ルールベーススコアリング層
 *
 * 仕様(CEO_UPDATE「スコアリング」): AIが100点を決めるのではない。
 * 占術・外部環境・ユーザー情報をルールベースでスコアリングし、
 * AIはそのスコアを解釈・要約・文章生成する役割のみを担う。
 *
 * この関数は決定論的(同じ入力なら必ず同じ点数)であり、ユニットテスト可能。
 * scoreBreakdownをDailyReportに保存することで、後から「なぜこの点数だったか」を
 * 監査でき、スコアリングルールの改善に使える(production_design.md §2)。
 */

export interface ScoreBreakdown {
  base: number; // 四柱推命の運気の波(20-100)
  envModifier: number; // 環境補正(-10〜+7)
  themeBonus: number; // テーマ一致ボーナス(0 or +5)
  final: number; // クランプ後の最終スコア
  stars: number; // ★1〜5
}

export function calculateDailyScore(params: {
  shichuWave: number;
  envModifier: number;
  userTheme: string | null;
  fortuneKeyword: string;
}): ScoreBreakdown {
  const { shichuWave, envModifier, userTheme, fortuneKeyword } = params;

  // テーマ一致ボーナス: ユーザーの現在テーマと今日の運勢キーワードが
  // 意味的に近い場合+5(「今日はあなたのテーマに追い風」を数値化)
  const themeBonus = userTheme && areThematicallyAligned(userTheme, fortuneKeyword) ? 5 : 0;

  const raw = shichuWave + envModifier + themeBonus;
  const final = Math.max(5, Math.min(100, Math.round(raw)));
  const stars = Math.max(1, Math.min(5, Math.ceil(final / 20)));

  return { base: shichuWave, envModifier, themeBonus, final, stars };
}

/** テーマ一致の簡易判定(Phase2)。Phase3で埋め込み類似度に置き換え可能な単一関数に隔離 */
const ALIGNMENT_GROUPS: string[][] = [
  ["挑戦", "決断", "行動", "転職", "仕事", "勝負"],
  ["信頼", "人間関係", "相性", "つながり"],
  ["準備", "継続", "積み重ね", "自分らしさ", "学び"],
];

function areThematicallyAligned(a: string, b: string): boolean {
  return ALIGNMENT_GROUPS.some((group) => group.includes(a) && group.includes(b));
}
