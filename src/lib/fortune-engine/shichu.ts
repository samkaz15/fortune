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

/**
 * 占術エンジン世代(D-0a 2026-07-12)。
 * v1 = 暫定ロジック(擬似画数・節入り無視・旧EPOCH 1984/2/2)
 * v2 = D-9修正(日柱基準1984/1/31)以降の正式化フェーズ
 * 保存済みの FortuneResult / DailyReport は再計算しない。新規生成時のみこの値を書き込む。
 */
export const FORTUNE_ENGINE_VERSION = 2;

import {
  jstMomentOf,
  sexagenaryYearIndex,
  sexagenaryMonthIndex,
  hourPillarOf,
} from "./setsuiri";

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

// 日柱の甲子基準日(D-9検証済み 2026-07-12)。
// 旧実装は 1984/2/2 を甲子としていたが、独立した暦実装2系統(lunar-python / cnlunar)との
// 突き合わせで 1984/2/2=丙寅日 と判明(=全日柱が2日ズレていた)。
// 正しくは 1984/1/31=甲子日。60日周期(1984/3/31=甲子)・60年前(1924/2/15=甲子)の整合も検証済み。
// 検証コードとゴールデンテスト: src/lib/fortune-engine/__tests__/golden.test.ts
const EPOCH = Date.UTC(1984, 0, 31);
const MS_PER_DAY = 86_400_000;

export function stemBranchIndexFromDate(date: Date): number {
  // 2026-07-12: 暦日をJST壁時計で解釈するよう修正。
  // 旧実装はサーバーローカル(Vercel=UTC)の日付部品を使っており、JSTの0:00〜8:59に
  // 「今日」を計算すると前日の日柱になる潜在バグがあった。
  const m = jstMomentOf(date);
  const diffDays = Math.floor((Date.UTC(m.year, m.month - 1, m.day) - EPOCH) / MS_PER_DAY);
  return ((diffDays % 60) + 60) % 60;
}

/**
 * 月柱インデックス(D-6正式化 2026-07-12)。
 * 十二節(立春・啓蟄・…)の節入り時刻(JST)で月が切り替わり、月干は五虎遁で導出する。
 * 実装本体は setsuiri.ts(節入りテーブル1900-2100同梱)。
 */
export function monthPillarIndexFromDate(date: Date): number {
  return sexagenaryMonthIndex(jstMomentOf(date));
}

/**
 * 年柱インデックス(D-6正式化 2026-07-12)。
 * 立春の節入り時刻(JST)を境に年が切り替わる。1984=甲子年基準。実装本体は setsuiri.ts。
 */
export function yearPillarIndexFromDate(date: Date): number {
  return sexagenaryYearIndex(jstMomentOf(date));
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

// ---------------- 四柱一括計算 (D-7: 時柱対応 / 2026-07-12) ----------------

export interface Pillar {
  index: number; // 60干支インデックス(甲子=0)
  stem: (typeof JIKKAN)[number];
  branch: (typeof JUNISHI)[number];
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** 出生時間(birthTime)が未入力の場合はnull(三柱推命として扱う) */
  hour: Pillar | null;
  /** 夜子時(23時台)により日柱を翌日へ進めたか(換日説オプション有効時のみtrue) */
  dayAdvancedByLateRatHour: boolean;
}

export interface FourPillarsOptions {
  /**
   * 夜子時(23時台)の日柱の扱い(要監修確認・両流派が実在):
   * - false(既定): 夜子時説 — 日柱は当日のまま、時干のみ翌日の日干から五鼠遁で起こす
   *   (検証に用いたlunar-pythonの既定と同一)
   * - true: 換日説 — 23時以降は日柱ごと翌日に切り替える
   * どちらの流派でも時柱そのものは同一になる(時干は常に翌日干ベース)。
   */
  lateRatHourAdvancesDay?: boolean;
}

function pillarOf(index: number): Pillar {
  return { index, stem: JIKKAN[index % 10], branch: JUNISHI[index % 12] };
}

/**
 * 生年月日(+任意の出生時間 "HH:mm")から四柱を立てる。
 * - 年柱: 立春切替 / 月柱: 節入り切替+五虎遁 / 日柱: D-9検証済みEPOCH / 時柱: 五鼠遁
 * - birthDate はDBの慣例どおり「UTC深夜の暦日」として保存されている前提
 *   (jstMomentOfでJST壁時計へ正規化して解釈する)。
 * - 地方時補正はPhase2(D-7決定)。
 */
export function calculateFourPillars(
  birthDate: Date,
  birthTime?: string | null,
  options: FourPillarsOptions = {}
): FourPillars {
  const timeMatch = birthTime?.match(/^(\d{1,2}):(\d{2})$/);
  const hour = timeMatch ? Number(timeMatch[1]) : null;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  // 年柱・月柱の節入り境界判定には出生「時刻」まで反映する(節入り当日生まれの精度確保)。
  // 出生時間未入力なら正午とみなす(JstMomentの既定。節入り当日・時刻不明は誤差があり得る)
  const birthMoment = { ...jstMomentOf(birthDate), hour: hour ?? undefined, minute: hour !== null ? minute : undefined };

  const dayIdx = stemBranchIndexFromDate(birthDate);
  let day = pillarOf(dayIdx);
  let hourPillar: Pillar | null = null;
  let dayAdvanced = false;

  if (hour !== null && hour >= 0 && hour <= 23) {
    const h = hourPillarOf(dayIdx, hour, minute); // 時干は流派に依らず翌日干ベース(hourPillarOf内で処理)
    hourPillar = pillarOf(h.index);
    if (h.dayAdvanced && options.lateRatHourAdvancesDay) {
      dayAdvanced = true;
      day = pillarOf((dayIdx + 1) % 60); // 換日説: 日柱も翌日へ
    }
  }

  return {
    year: pillarOf(sexagenaryYearIndex(birthMoment)),
    month: pillarOf(sexagenaryMonthIndex(birthMoment)),
    day,
    hour: hourPillar,
    dayAdvancedByLateRatHour: dayAdvanced,
  };
}
