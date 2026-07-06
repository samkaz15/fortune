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
  // ---- UI仕様v5で追加した吉日(重複判定は呼び出し側でgood配列として自然に共存) ----
  if (branch === "寅") good.push("寅の日"); // 金運(千里を往って千里を還る)
  if (kanshi === "己巳") good.push("己巳の日"); // 弁財天の縁日
  if (kanshi === "甲子") good.push("甲子の日"); // 六十干支の始まり
  const solar = solarTerm(date);
  if (solar) good.push(solar); // 春分/秋分/夏至/冬至
  if (isFushoju(date)) bad.push("不成就日");
  if (JUSHI[sm - 1] === branch) bad.push("受死日");
  if (JISSHI[sm - 1] === branch) bad.push("十死日");
  return { kanshi, stem, branch, good, bad };
}

/** 二至二分(春分/夏至/秋分/冬至)。天文計算の固定日近似(±1日の年差は許容) */
function solarTerm(date: Date): string | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m === 3 && d === 20) return "春分";
  if (m === 6 && d === 21) return "夏至";
  if (m === 9 && d === 23) return "秋分";
  if (m === 12 && d === 22) return "冬至";
  return null;
}

/**
 * 不成就日の簡易近似。本来は旧暦8日周期(朔日基準)だが、旧暦変換を持たないため
 * 新月周期(29.53日)から朔日を推定して8日周期を刻む近似実装。
 * 玄空大卦択日法・烏兎太陽択日法は択日(個別日選定)の高度体系のため、
 * パーソナル判定(fengshui-calendar側の四柱×日干支スコア)で代替している。
 */
function isFushoju(date: Date): boolean {
  const SYNODIC = 29.530588853 * 86_400_000;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06の朔
  const t = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const sinceNew = ((t - KNOWN_NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC;
  const lunarDay = Math.floor(sinceNew / 86_400_000); // 旧暦日の近似(0=朔)
  return lunarDay % 8 === 2; // 3日・11日・19日・27日型の近似
}
