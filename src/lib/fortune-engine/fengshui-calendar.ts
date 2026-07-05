/**
 * 風水カレンダー: 暦注下段 × 本人の四柱推命(日柱)で日別の吉凶スコアを算出する
 *
 * - 暦注下段(rekichuu.ts): 天赦日+4 / 一粒万倍日+2 / 大明日+1 / 母倉日+1 / 受死日-3 / 十死日-2
 * - パーソナル(本人の日支×対象日の日支): 支合+2 / 三合+2 / 冲-3 / 害-1
 * - パーソナル(五行): 対象日の日干が本人日干を生む(相生)+1 / 同じ(比和)+1 / 剋す-1
 *
 * 表示ルール(CEO要求 2026-07-05):
 * - 月内で最高スコア(かつ+3以上)の日 = 黄色(bestDay)
 * - スコア-3以下 = 淡い赤(cautionDay: 心が揺れやすい注意日)
 * - 注意日を含む週 = 週全体をさらに薄い赤(cautionWeek)
 */
import { JIKKAN, JUNISHI, stemBranchIndexFromDate } from "./shichu";
import { calcRekichuu } from "./rekichuu";

const GOGYO: Record<string, "木" | "火" | "土" | "金" | "水"> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};
const SHENG: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" }; // 生じる
const KE: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" }; // 剋す

const SHIGO: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
const CHU: Record<string, string> = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
const GAI: Record<string, string> = { 子: "未", 未: "子", 丑: "午", 午: "丑", 寅: "巳", 巳: "寅", 卯: "辰", 辰: "卯", 申: "亥", 亥: "申", 酉: "戌", 戌: "酉" };
const SANGO: string[][] = [["申", "子", "辰"], ["寅", "午", "戌"], ["巳", "酉", "丑"], ["亥", "卯", "未"]];

export interface FengshuiDay {
  date: string; // YYYY-MM-DD
  kanshi: string;
  good: string[]; // 暦注下段の吉
  bad: string[]; // 暦注下段の凶
  personalPoints: string[]; // 本人向けの良いポイント(四柱推命由来・翻訳済み文言)
  personalCautions: string[];
  score: number;
  isBest: boolean;
  isCaution: boolean;
}

export interface FengshuiMonth {
  month: string; // YYYY-MM
  days: FengshuiDay[];
  cautionWeeks: number[]; // 注意日を含む週index(0始まり・日曜始まり)
}

export function buildFengshuiMonth(birthDate: Date, year: number, month1to12: number): FengshuiMonth {
  const userIdx = stemBranchIndexFromDate(birthDate);
  const userStem = JIKKAN[userIdx % 10];
  const userBranch = JUNISHI[userIdx % 12];
  const userEl = GOGYO[userStem];
  const userSango = SANGO.find((g) => g.includes(userBranch)) ?? [];

  const daysInMonth = new Date(year, month1to12, 0).getDate();
  const days: FengshuiDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month1to12 - 1, d);
    const rk = calcRekichuu(date);
    let score = 0;
    for (const g of rk.good) score += g === "天赦日" ? 4 : g === "一粒万倍日" ? 2 : 1;
    for (const b of rk.bad) score -= b === "受死日" ? 3 : 2;

    const personalPoints: string[] = [];
    const personalCautions: string[] = [];
    const branch = rk.branch;
    if (SHIGO[userBranch] === branch) { score += 2; personalPoints.push("縁がまとまりやすい日(お願いごと・約束に◎)"); }
    if (userSango.includes(branch) && branch !== userBranch) { score += 2; personalPoints.push("流れが噛み合う日(人と会う・チームで動くに◎)"); }
    if (branch === userBranch) { score += 1; personalPoints.push("自分の軸が強く出る日(自分で決めることに◎)"); }
    if (CHU[userBranch] === branch) { score -= 3; personalCautions.push("心が揺れやすい日。大事な決断は避けて、休息を"); }
    if (GAI[userBranch] === branch) { score -= 1; personalCautions.push("すれ違いが起きやすい日。言葉は丁寧に"); }

    const dayEl = GOGYO[rk.stem];
    if (SHENG[dayEl] === userEl) { score += 1; personalPoints.push("エネルギーが入ってくる日(新しく始めるに◎)"); }
    else if (dayEl === userEl) { score += 1; personalPoints.push("地に足がつく日(継続・積み上げに◎)"); }
    else if (KE[dayEl] === userEl) { score -= 1; }

    days.push({
      date: `${year}-${String(month1to12).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      kanshi: rk.kanshi,
      good: rk.good,
      bad: rk.bad,
      personalPoints,
      personalCautions,
      score,
      isBest: false,
      isCaution: score <= -3,
    });
  }

  // 月内最高スコア(+3以上)を黄色に
  const max = Math.max(...days.map((d) => d.score));
  if (max >= 3) for (const d of days) if (d.score === max) d.isBest = true;

  // 注意日を含む週(日曜始まり)
  const firstDow = new Date(year, month1to12 - 1, 1).getDay();
  const cautionWeeks = new Set<number>();
  days.forEach((d, i) => {
    if (d.isCaution) cautionWeeks.add(Math.floor((i + firstDow) / 7));
  });

  return { month: `${year}-${String(month1to12).padStart(2, "0")}`, days, cautionWeeks: [...cautionWeeks] };
}
