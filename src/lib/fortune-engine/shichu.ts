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

export const JIKKAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const JUNISHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

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

export function stemBranchIndexFromDate(date: Date): number {
  const diffDays = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / MS_PER_DAY);
  return ((diffDays % 60) + 60) % 60;
}

/**
 * 月柱インデックス(2026-07-07新設)。
 * ⚠️ 正式な四柱推命は二十四節気の「節」(立春・啓蟄等)で月が切り替わるが、
 * ここではグレゴリオ暦の月初を基準にした簡易近似(CEO占術監修時に節入り計算へ差し替え推奨)。
 * 年初からの通し月数を60で循環させ、日柱とは独立した「月の巡り」を表現する。
 */
export function monthPillarIndexFromDate(date: Date): number {
  const monthsFromEpoch = (date.getFullYear() - 2000) * 12 + date.getMonth();
  return ((monthsFromEpoch % 60) + 60) % 60;
}

/**
 * 年柱インデックス(2026-07-07新設)。
 * ⚠️ 正式には立春(2/4頃)を境に年が切り替わるが、ここではグレゴリオ暦の1/1を基準にした簡易近似。
 */
export function yearPillarIndexFromDate(date: Date): number {
  return (((date.getFullYear() - 1984) % 60) + 60) % 60; // 1984=甲子年を基準
}

export type PeriodUnit = "day" | "week" | "month" | "year";

/**
 * 期間種別ごとに専用の柱を使い分けて運気波を計算する(2026-07-07新設)。
 * 四柱推命の本来の構造どおり: 日運=日柱、月運=月柱、年運=年柱で相性を見る。
 * 週運は伝統的な四柱推命に存在しない単位のため、日柱をベースに扱う(一般的な占いサービスの実務慣行)。
 */
export function calculateShichu(
  birthDate: Date,
  targetDate: Date = new Date(),
  periodUnit: PeriodUnit = "day"
): ShichuSummary {
  const idx = stemBranchIndexFromDate(birthDate);
  const stem = JIKKAN[idx % 10];
  const branch = JUNISHI[idx % 12];
  const element = GOGYO_OF_JIKKAN[stem];

  // 「今日の運気の波」(2026-07-07修正): 五行5種のみでは粒度が粗く、
  // 期間タブ(今日/今週/今月/来月)の代表日が同じ五行に当たると同一スコアになるバグがあった。
  // 60干支の周期距離(0-30)を主軸にし、五行の相性を補正として加える2段構成に変更。
  // 期間種別に応じて「対象の柱」を切り替える(日運=日柱/週運=日柱/月運=月柱/年運=年柱)
  const targetIdx =
    periodUnit === "month"
      ? monthPillarIndexFromDate(targetDate)
      : periodUnit === "year"
        ? yearPillarIndexFromDate(targetDate)
        : stemBranchIndexFromDate(targetDate); // day/week は日柱

  const todayIdx = targetIdx;
  const todayElement = GOGYO_OF_JIKKAN[JIKKAN[todayIdx % 10]];

  // 60干支の円環距離(0=相性最良 〜 30=正反対)
  const cycleDiff = Math.abs(idx - todayIdx) % 60;
  const cycleDistance = Math.min(cycleDiff, 60 - cycleDiff); // 0-30

  // 五行の相性(相生・相剋)による補正: 同じ五行=+8、相剋(離れた関係)=-8
  const elementOrder = ["木", "火", "土", "金", "水"] as const;
  const elementDistance = Math.abs(elementOrder.indexOf(element) - elementOrder.indexOf(todayElement));
  const elementBonus = elementDistance === 0 ? 8 : elementDistance >= 3 ? -8 : 0;

  // cycleDistance(0-30)を100-40のレンジへ線形マップし、五行補正を加える
  const wave = Math.round(100 - (cycleDistance / 30) * 60 + elementBonus);

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
