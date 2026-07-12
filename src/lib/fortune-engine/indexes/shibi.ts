/**
 * 紫微斗数(簡易版) (マルチインデックス拡張 / 2026-07-12)
 *
 * 実装範囲: 命宮・身宮の宮位(十二支)の算出と、その宮位の基本性質の辞書解釈まで。
 * 十四主星の配置(紫微星系・天府星系)はPhase2(要監修: 五行局の算出と起紫微訣の流派確定が必要)。
 *
 * 算出方法(標準的な起命宮訣):
 *   寅宮を旧暦1月として順に数えて生まれ月の宮を取り、その宮を子の刻として
 *   生まれ時刻まで「逆」に数えた宮が命宮。「順」に数えた宮が身宮。
 *   命宮支 = (寅(2) + (旧暦月-1) - 時支) mod 12 / 身宮支 = (寅(2) + (旧暦月-1) + 時支) mod 12
 *
 * 旧暦月はdata/lunar-months-1900-2100.json(lunar-python生成・cnlunar突き合わせ済み)から引く。
 * 閏月は本月と同じ月番号として扱う(流派差あり・要監修)。
 * 出生時間が無い場合はnullを返す(紫微斗数は時刻必須の占術のため、正午仮定はしない)。
 */
import lunarMonths from "../data/lunar-months-1900-2100.json";
import { JUNISHI } from "../shichu";

interface LunarMonthRow {
  start: string;
  year: number;
  month: number;
  leap: boolean;
}

export interface ShibiResult {
  meiguu: string; // 命宮の十二支
  shinguu: string; // 身宮の十二支
  lunarMonth: number;
  lunarLeap: boolean;
  keywords: string[]; // 命宮の基本性質(簡易辞書・要監修)
}

/** 命宮の宮位ごとの基本性質(簡易辞書。主星配置前の暫定解釈・要監修) */
const PALACE_KEYWORDS: Record<string, string[]> = {
  子: ["機知", "適応", "夜型の集中力"],
  丑: ["忍耐", "蓄積", "遅咲き"],
  寅: ["始動", "行動力", "開拓"],
  卯: ["柔軟", "社交", "調整力"],
  辰: ["野心", "構想", "スケール"],
  巳: ["知略", "美意識", "深い集中"],
  午: ["情熱", "表現", "存在感"],
  未: ["温和", "支援", "信頼構築"],
  申: ["器用", "多才", "機動力"],
  酉: ["精密", "審美", "完成度"],
  戌: ["誠実", "防御", "忠義"],
  亥: ["包容", "直感", "大局観"],
};

/** 新暦の暦日から旧暦月を引く(テーブル二分探索) */
function lunarMonthOf(birthDate: Date): LunarMonthRow | null {
  const target = birthDate.toISOString().slice(0, 10);
  const rows = lunarMonths as LunarMonthRow[];
  let lo = 0;
  let hi = rows.length - 1;
  let ans: LunarMonthRow | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].start <= target) {
      ans = rows[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function calculateShibi(birthDate: Date, birthTime: string | null | undefined): ShibiResult | null {
  const timeMatch = birthTime?.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return null; // 時刻必須

  const lunar = lunarMonthOf(birthDate);
  if (!lunar) return null; // テーブル範囲外

  const hour = Number(timeMatch[1]);
  const hourBranch = Math.floor(((hour + 1) % 24) / 2); // 子=0(shichuの時支と同一規則)

  const m = lunar.month; // 閏月は本月扱い(要監修)
  const meiguuIdx = (((2 + (m - 1) - hourBranch) % 12) + 12) % 12;
  const shinguuIdx = (((2 + (m - 1) + hourBranch) % 12) + 12) % 12;

  const meiguu = JUNISHI[meiguuIdx];
  return {
    meiguu,
    shinguu: JUNISHI[shinguuIdx],
    lunarMonth: m,
    lunarLeap: lunar.leap,
    keywords: PALACE_KEYWORDS[meiguu] ?? [],
  };
}
