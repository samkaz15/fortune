/**
 * MBTIモジュール (マルチインデックス拡張 / 2026-07-12)
 *
 * MBTIは生年月日から導出できない(自己申告制)ため、UserProfile.mbti に保存された
 * タイプを辞書で解釈する。未設定ならnull(占術統合時はスキップされる)。
 * 16タイプの記述は一般に流布している類型論の要約(公式MBTI®の文言は使用しない)。
 *
 * 占術との掛け合わせ方針: MBTIは「本人の自己認識」、命式は「生まれ持った設計図」。
 * 両者のズレ(例: 命式は貫索星=独立志向なのに自己認識はISFJ=支援型)こそが
 * 「バグの解剖」の最良の材料になる — LLMプロンプトへそのまま渡す。
 */

export interface MbtiResult {
  type: string;
  group: "分析家" | "外交官" | "番人" | "探検家";
  keywords: string[];
}

const MBTI_DICT: Record<string, { group: MbtiResult["group"]; keywords: string[] }> = {
  INTJ: { group: "分析家", keywords: ["戦略", "独立", "長期視点"] },
  INTP: { group: "分析家", keywords: ["論理", "探究", "概念思考"] },
  ENTJ: { group: "分析家", keywords: ["統率", "決断", "目標達成"] },
  ENTP: { group: "分析家", keywords: ["発想", "討論", "可能性"] },
  INFJ: { group: "外交官", keywords: ["洞察", "理想", "静かな信念"] },
  INFP: { group: "外交官", keywords: ["価値観", "共感", "内的世界"] },
  ENFJ: { group: "外交官", keywords: ["導き", "調和", "人の成長"] },
  ENFP: { group: "外交官", keywords: ["情熱", "好奇心", "つながり"] },
  ISTJ: { group: "番人", keywords: ["責任", "着実", "秩序"] },
  ISFJ: { group: "番人", keywords: ["献身", "気配り", "記憶力"] },
  ESTJ: { group: "番人", keywords: ["管理", "実行", "伝統"] },
  ESFJ: { group: "番人", keywords: ["世話", "協調", "場づくり"] },
  ISTP: { group: "探検家", keywords: ["職人", "冷静", "問題解決"] },
  ISFP: { group: "探検家", keywords: ["感性", "柔軟", "いまここ"] },
  ESTP: { group: "探検家", keywords: ["行動", "臨機応変", "勝負勘"] },
  ESFP: { group: "探検家", keywords: ["社交", "楽しさ", "現場力"] },
};

export function interpretMbti(type: string | null | undefined): MbtiResult | null {
  if (!type) return null;
  const key = type.toUpperCase().trim();
  const entry = MBTI_DICT[key];
  if (!entry) return null;
  return { type: key, ...entry };
}

export const MBTI_TYPES = Object.keys(MBTI_DICT);
