/**
 * 暦注下段(れきちゅうげだん)の簡易計算
 *
 * 日の干支(shichu.tsと同じ基準で算出)と節月から、代表的な暦注下段を判定する。
 * 暦注下段は文献により諸説あるため、本実装は一般に流通している対応表を採用した
 * 「糸町の少年式」の簡易版である(節入りも固定日近似)。UIには占術名を出さない方針だが、
 * 風水カレンダーは「暦の上での吉日」という一般名で表示するため例外的に暦注名を表示してよい
 * (CEO確認済みの機能要求 2026-07-05)。
 */
import { JIKKAN, JUNISHI, stemBranchIndexFromDate } from "./shichu";

/** 節入り日(固定近似): index0=1月。値=その月の節入り日 */
const SETSU_DAYS = [5, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7];

/** グレゴリオ暦の月日→節月(寅月=1 … 丑月=12) */
export function setsuMonth(date: Date): number {
  const m = date.getMonth() + 1; // 1-12
  const d = date.getDate();
  // 節入り前は前月扱い
  const effMonth = d >= SETSU_DAYS[m - 1] ? m : m === 1 ? 12 : m - 1;
  // 2月(立春)=寅月=1
  return ((effMonth - 2 + 12) % 12) + 1;
}

function season(setsuM: number): "spring" | "summer" | "autumn" | "winter" {
  if (setsuM <= 3) return "spring";
  if (setsuM <= 6) return "summer";
  if (setsuM <= 9) return "autumn";
  return "winter";
}

// 一粒万倍日(節月→日支)。諸説のうち一般的な表を採用
const ICHIRYU: Record<number, string[]> = {
  1: ["丑", "午"], 2: ["酉", "寅"], 3: ["子", "卯"], 4: ["卯", "辰"],
  5: ["巳", "午"], 6: ["午", "酉"], 7: ["子", "未"], 8: ["卯", "申"],
  9: ["午", "酉"], 10: ["酉", "戌"], 11: ["子", "亥"], 12: ["卯", "子"],
};
// 天赦日(季節→日干支)
const TENSHA: Record<string, string> = { spring: "戊寅", summer: "甲午", autumn: "戊申", winter: "甲子" };
// 大明日(日干支)
const DAIMYO = new Set(["己巳","庚午","辛未","壬申","癸酉","丁丑","己卯","壬午","甲申","丁亥","壬辰","乙未","壬寅","甲辰","乙巳","丙午","丁未","己酉","庚戌","辛亥","辛酉"]);
// 母倉日(季節→日支)
const BOSO: Record<string, string[]> = { spring: ["子","亥"], summer: ["寅","卯"], autumn: ["辰","戌","丑","未"], winter: ["申","酉"] };
// 受死日(節月→日支)
const JUSHI = ["戌","辰","亥","巳","子","午","丑","未","寅","申","卯","酉"];
// 十死日(節月→日支)
const JISSHI = ["酉","巳","丑","酉","巳","丑","酉","巳","丑","酉","巳","丑"];

export interface RekichuuResult {
  kanshi: string; // 例: 戊午
  stem: string;
  branch: string;
  good: string[]; // 吉の暦注下段
  bad: string[]; // 凶の暦注下段
}

export function calcRekichuu(date: Date): RekichuuResult {
  const idx = stemBranchIndexFromDate(date);
  const stem = JIKKAN[idx % 10];
  const branch = JUNISHI[idx % 12];
  const kanshi = `${stem}${branch}`;
  const sm = setsuMonth(date);
  const sz = season(sm);

  const good: string[] = [];
  const bad: string[] = [];
  if (TENSHA[sz] === kanshi) good.push("天赦日");
  if (ICHIRYU[sm]?.includes(branch)) good.push("一粒万倍日");
  if (DAIMYO.has(kanshi)) good.push("大明日");
  if (BOSO[sz]?.includes(branch)) good.push("母倉日");
  if (JUSHI[sm - 1] === branch) bad.push("受死日");
  if (JISSHI[sm - 1] === branch) bad.push("十死日");
  return { kanshi, stem, branch, good, bad };
}
