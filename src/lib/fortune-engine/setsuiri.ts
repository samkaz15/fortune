/**
 * 節入り・四柱計算モジュール (CEO1 D-6/D-7 / 2026-07-12)
 *
 * - 年柱: 立春(節入りテーブルのJST時刻)を境に切り替え(D-6)
 * - 月柱: 十二節(立春・啓蟄・…・小寒)を境に切り替え+五虎遁で月干を導出(D-6)
 * - 時柱: 2時間区切りの十二支+五鼠遁で時干を導出(D-7)
 *   ※ 23時台(夜子時)は「翌日の日柱で計算する」流派を既定とする(lunar-python既定sectと同一)。
 *     反対流派(当日のまま)も存在するため監修者確認事項(seimei-review.json参照)。
 * - 地方時補正はPhase2(D-7決定どおり延期)。全時刻はJST壁時計として扱う。
 *
 * データ: data/setsuiri-1900-2100.json(lunar-python由来・JST変換済み・生成スクリプトは
 * scripts/generate_setsuiri_table.py)。範囲外の年はエラーではなく近似(グレゴリオ暦2/4)へ
 * フォールバックし、console.warnを出す。
 */
import setsuiriTable from "./data/setsuiri-1900-2100.json";

export const SETSU_NAMES = [
  "小寒", "立春", "啓蟄", "清明", "立夏", "芒種",
  "小暑", "立秋", "白露", "寒露", "立冬", "大雪",
] as const;
export type SetsuName = (typeof SETSU_NAMES)[number];

/** 各節が開始する月の十二支(子=0…亥=11)。立春=寅月(2)から順に巡る */
const SETSU_TO_MONTH_BRANCH: Record<SetsuName, number> = {
  小寒: 1, 立春: 2, 啓蟄: 3, 清明: 4, 立夏: 5, 芒種: 6,
  小暑: 7, 立秋: 8, 白露: 9, 寒露: 10, 立冬: 11, 大雪: 0,
};

/** JST壁時計。timezoneのブレを避けるため、Date型ではなく数値で受け渡す */
export interface JstMoment {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour?: number; // 0-23(省略時は正午12時とみなす。節入り当日・時刻不明の出生は要注意)
  minute?: number;
}

/** JstMoment → 比較用エポックms(JSTをUTC+9として絶対時刻化) */
function epochOf(m: JstMoment): number {
  return Date.UTC(m.year, m.month - 1, m.day, (m.hour ?? 12) - 9, m.minute ?? 0);
}

/** 節入り時刻(JST)を取得。テーブル範囲外(1900-2100外)はnull */
export function setsuiriOf(year: number, name: SetsuName): Date | null {
  const entry = (setsuiriTable as Record<string, Record<string, string>>)[String(year)];
  if (!entry?.[name]) return null;
  return new Date(entry[name]); // ISO文字列(+09:00付き)なので絶対時刻として正しくparseされる
}

/** Date型(絶対時刻)をJST壁時計のJstMomentへ変換 */
export function jstMomentOf(date: Date): JstMoment {
  const shifted = new Date(date.getTime() + 9 * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** 60干支のインデックス(甲子=0)を干(0-9)と支(0-11)の組から求める(中国剰余) */
export function combineStemBranch(stem: number, branch: number): number {
  for (let n = branch % 12; n < 60; n += 12) {
    if (n % 10 === stem) return n;
  }
  throw new Error(`invalid stem/branch pair: ${stem}/${branch}`); // 干支の陰陽不一致(発生しない組)
}

/**
 * 年柱インデックス(甲子=0)。立春の節入り時刻(JST)を境に年が切り替わる(D-6)。
 * 1984年=甲子年基準。
 */
export function sexagenaryYearIndex(m: JstMoment): number {
  let year = m.year;
  const risshun = setsuiriOf(m.year, "立春");
  if (risshun) {
    if (epochOf(m) < risshun.getTime()) year -= 1;
  } else {
    // テーブル範囲外: 2/4正午を近似境界とするフォールバック
    console.warn(`[setsuiri] ${m.year}年はテーブル範囲外。立春=2/4正午で近似します`);
    if (epochOf(m) < Date.UTC(m.year, 1, 4, 12 - 9)) year -= 1;
  }
  return (((year - 1984) % 60) + 60) % 60;
}

/**
 * 月柱インデックス(甲子=0)。十二節の節入り時刻を境に月が切り替わり(D-6)、
 * 月干は五虎遁(年干から寅月の干を起こす)で導出する。
 *   甲・己年→丙寅月 / 乙・庚年→戊寅月 / 丙・辛年→庚寅月 / 丁・壬年→壬寅月 / 戊・癸年→甲寅月
 */
export function sexagenaryMonthIndex(m: JstMoment): number {
  const t = epochOf(m);

  // その時点が属する「節」を特定する(前年の大雪〜当年の大雪の範囲を走査)
  let currentSetsu: SetsuName = "大雪"; // 小寒より前=前年の大雪以降の子月
  let setsuYearOffset = -1; // 大雪(前年)由来なら-1
  for (const name of SETSU_NAMES) {
    const moment = setsuiriOf(m.year, name);
    const boundary = moment
      ? moment.getTime()
      : Date.UTC(m.year, approxMonthOf(name) - 1, 6, 12 - 9); // 範囲外フォールバック(各節≒6日)
    if (t >= boundary) {
      currentSetsu = name;
      setsuYearOffset = 0;
    }
  }

  const branch = SETSU_TO_MONTH_BRANCH[currentSetsu];
  void setsuYearOffset; // 年干の判定はsexagenaryYearIndexが立春基準で行うため補正不要

  // 五虎遁: 年干(0-9)から寅月(branch=2)の月干を起こし、月支の巡りぶん進める
  const yearStem = sexagenaryYearIndex(m) % 10;
  const monthOffsetFromTora = (branch - 2 + 12) % 12; // 寅月からの経過月数
  const stem = ((yearStem % 5) * 2 + 2 + monthOffsetFromTora) % 10;
  return combineStemBranch(stem, branch);
}

/** テーブル範囲外年の近似用: 各節のおおよその月 */
function approxMonthOf(name: SetsuName): number {
  return { 小寒: 1, 立春: 2, 啓蟄: 3, 清明: 4, 立夏: 5, 芒種: 6, 小暑: 7, 立秋: 8, 白露: 9, 寒露: 10, 立冬: 11, 大雪: 12 }[name];
}

/**
 * 時柱(D-7)。
 * - 時支: 23:00-0:59=子, 1:00-2:59=丑, …(2時間区切り)
 * - 時干: 五鼠遁(日干から子時の干を起こす)
 *   甲・己日→甲子時 / 乙・庚日→丙子時 / 丙・辛日→戊子時 / 丁・壬日→庚子時 / 戊・癸日→壬子時
 * - 夜子時(23時台)は「翌日の日柱」で干を起こす流派を既定とする(要監修確認)。
 *
 * @param dayPillarIndex その日(暦日)の日柱インデックス(甲子=0)
 * @returns 時柱インデックスと、夜子時により日柱を翌日へ進めたかどうか
 */
export function hourPillarOf(
  dayPillarIndex: number,
  hour: number,
  minute: number = 0
): { index: number; dayAdvanced: boolean } {
  void minute; // 現状は時単位で確定(分は将来の地方時補正Phase2で使用)
  const dayAdvanced = hour >= 23;
  const effectiveDayIdx = dayAdvanced ? (dayPillarIndex + 1) % 60 : dayPillarIndex;
  const branch = Math.floor(((hour + 1) % 24) / 2); // 23,0時→子(0), 1,2時→丑(1)…
  const dayStem = effectiveDayIdx % 10;
  const stem = ((dayStem % 5) * 2 + branch) % 10;
  return { index: combineStemBranch(stem, branch), dayAdvanced };
}
