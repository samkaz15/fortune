/**
 * 四柱推命（簡易実装）
 *
 * ⚠️ 実データ未整備の暫定実装:
 * 正式な四柱推命は生年月日時から「年柱・月柱・日柱・時柱」の干支(十干十二支)を
 * 暦(旧暦・節入り等)を考慮して算出する必要がある。ここでは節入り計算を省略し、
 * グレゴリオ暦の日付から干支インデックスを直接計算する簡易版にしている。
 * → CEO占術監修(CEO1)で採用する流派・節入り基準を確定した後、
 *   本格的な暦計算ライブラリ(または専用API)に差し替えることを推奨する。
 */

const JIKKAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const JUNISHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

const GOGYO_OF_JIKKAN: Record<(typeof JIKKAN)[number], "木" | "火" | "土" | "金" | "水"> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土",
  庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

export interface ShichuSummary {
  dayStem: (typeof JIKKAN)[number];
  dayBranch: (typeof JUNISHI)[number];
  element: "木" | "火" | "土" | "金" | "水";
  /** 五行に応じた今日の運気の波（0-100） */
  wave: number;
  advice: string;
}

// 1984/2/2(甲子の年とされる基準日に近い日)を甲子の起点として簡易計算する
const EPOCH = Date.UTC(1984, 1, 2);
const MS_PER_DAY = 86_400_000;

function stemBranchIndexFromDate(date: Date): number {
  const diffDays = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / MS_PER_DAY);
  return ((diffDays % 60) + 60) % 60;
}

export function calculateShichu(birthDate: Date, targetDate: Date = new Date()): ShichuSummary {
  const idx = stemBranchIndexFromDate(birthDate);
  const stem = JIKKAN[idx % 10];
  const branch = JUNISHI[idx % 12];
  const element = GOGYO_OF_JIKKAN[stem];

  // 「今日の運気の波」は日柱の五行と、対象日(今日)の五行の相性で簡易算出(暫定ロジック)
  const todayIdx = stemBranchIndexFromDate(targetDate);
  const todayElement = GOGYO_OF_JIKKAN[JIKKAN[todayIdx % 10]];
  const elementOrder = ["木", "火", "土", "金", "水"] as const;
  const distance = Math.abs(elementOrder.indexOf(element) - elementOrder.indexOf(todayElement));
  const wave = 100 - distance * 15; // 相生に近いほど高スコア(暫定)

  const adviceMap: Record<string, string> = {
    木: "新しいことを始めるより、今ある計画を育てる意識で過ごすとうまくいく",
    火: "行動力が高まる日。気になっていた連絡や提案は今日中に動くと良い",
    土: "足元を整える日。焦らず、地道な作業に時間を使うと信頼が積み上がる",
    金: "判断力が冴える日。迷っていた決断は今日のうちに固めておくと良い",
    水: "柔軟に動ける日。人の意見を取り入れると思わぬ好転につながる",
  };

  return {
    dayStem: stem,
    dayBranch: branch,
    element,
    wave: Math.max(20, Math.min(100, wave)),
    advice: adviceMap[element],
  };
}
