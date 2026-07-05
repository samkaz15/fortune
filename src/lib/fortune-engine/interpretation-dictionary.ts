/**
 * 占い解釈辞書（Core Mapping Spec / CEO_INTERPRETATION_dictionary.md 2026-07-05確定）
 *
 * ここは「解釈層」。計算層(shichu/rekichuu/horoscope/seimei/sanmei)が出した
 * 暦・干支・天体の事実を、プロダクト独自ルールで「状態→行動」に変換する唯一の辞書。
 *
 * 設計原則:
 * - 占いは未来予測ではなく「状態を構造化し、次の行動を整理するための入力データ」
 * - 正しさではなく 一貫性(同じ入力=同じ出力)・再現性・UX整合性 を担保する
 * - 流派・占術名・重みはユーザーに一切開示しない
 * - 出力は必ず「①状態 ②傾向 ③注意点1つ ④行動1つ」に収束させる
 */

/** 複数占術の統合重み(Q6確定・非公開) */
export const ENGINE_WEIGHTS = {
  shichu: 0.5, // 四柱推命
  gogyo: 0.3, // 五行
  tentai: 0.2, // 天体(ホロスコープ)
} as const;

export interface DayStemState {
  state: string;
  description: string;
  action: string;
}

/** 1. 日干 → 状態マッピング(CEO確定値そのまま) */
export const dayStemStateMap: Record<string, DayStemState> = {
  甲: { state: "拡張・成長", description: "外に広げる力が強い。新規開始に適性。", action: "新しい選択肢を増やす" },
  乙: { state: "柔軟・調整", description: "環境適応力が高い。変化対応型。", action: "流れに合わせて最適化する" },
  丙: { state: "表現・発信", description: "外向性が強く影響力がある。", action: "意思表示を明確にする" },
  丁: { state: "集中・内省", description: "一点集中型。深く考える力。", action: "決断前に整理する" },
  戊: { state: "安定・基盤", description: "維持・安定・構造化が得意。", action: "現状整理と維持を優先する" },
  己: { state: "最適化・改善", description: "調整・改善・現実適応。", action: "無駄を削り整える" },
  庚: { state: "決断・切断", description: "決定力と切り替えが強い。", action: "選択を一つに絞る" },
  辛: { state: "選別・分析", description: "精度重視・判断力が高い。", action: "情報を精査する" },
  壬: { state: "流動・変化", description: "環境変化に強い柔軟性。", action: "選択肢を広げる" },
  癸: { state: "吸収・準備", description: "学習・蓄積フェーズ。", action: "準備期間として整理する" },
};

/** 2. 五行バランス → 行動補正(CEO確定値そのまま) */
export const fiveElementAdjustment: Record<string, string> = {
  木: "成長・開始を促す",
  火: "発信・行動を促す",
  土: "安定・整理を促す",
  金: "判断・選別を促す",
  水: "柔軟・吸収を促す",
};

/** 3. 相性ロジック(恋愛) */
export const compatibilityRule = {
  harmony: ["相生関係"], // 生じ合う=調和
  tension: ["相剋関係"], // 剋し合う=緊張(悪ではなく「整理が必要な関係」と表現する)
  neutral: ["同属性"],
} as const;

/** 4. 出力フォーマット(絶対固定) */
export const OUTPUT_FORMAT = ["① 現在の状態", "② 性質の傾向", "③ 注意点(1つ)", "④ 行動(1つだけ)"] as const;

/** 5. 禁止ルール(プロンプト・レビューの両方でチェックする) */
export const FORBIDDEN_RULES = [
  "転職向き/不向きの断定禁止",
  "未来確定表現禁止",
  "流派説明禁止",
  "スピリチュアル表現禁止",
] as const;

/**
 * 日干から4部構成の素材を返す(フォールバック・プロンプト素材の共通入口)。
 * 「向き/不向き」ではなく「状態→行動」で返す(Q3)。
 */
export function interpretDayStem(stem: string): DayStemState {
  return dayStemStateMap[stem] ?? dayStemStateMap["戊"];
}
