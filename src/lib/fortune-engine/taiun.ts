/**
 * 大運(10年周期の運気)計算 (CEO1 D-10 / 2026-07-12)
 *
 * 決定事項: 立運=節入りまでの日数÷3(3日=1年、余り1日=4ヶ月)。
 * - 順逆: 陽年干の男性・陰年干の女性=順行(月柱から先へ) / それ以外=逆行
 * - 順行は出生→次の節入り、逆行は直前の節入り→出生の日数で立運を求める
 * - 各大運に十大主星(日干×大運干)・十二大従星(日干×大運支)を付与し、
 *   人生カルテ(UserKarte.lifeCycle)とLLMの物語生成のデータ源とする
 * - 性別が male/female 以外(other/unspecified/未入力)の場合は順逆が定義できないため
 *   nullを返す(UI側で出生時間・性別の入力を促す)。※この扱いは要監修確認
 *
 * 検証: lunar-pythonの大運計算(起運年月・干支列)との突き合わせ(golden.test.ts)
 */
import { JIKKAN, JUNISHI, calculateFourPillars } from "./shichu";
import { setsuiriOf, jstMomentOf, SETSU_NAMES, type SetsuName } from "./setsuiri";
import { shuseiOf, juuseiOf } from "./tsuhensei";

export interface TaiunPillar {
  /** 60干支インデックス(甲子=0) */
  index: number;
  stem: (typeof JIKKAN)[number];
  branch: (typeof JUNISHI)[number];
  /** この大運が始まる満年齢(年・月) */
  startAgeYears: number;
  startAgeMonths: number;
  /** 高尾学館系の一般名称による星(LLM生成・カルテ表示用) */
  shusei: string;
  juusei: string;
}

export interface TaiunResult {
  forward: boolean; // 順行か
  /** 立運(第1大運が始まる満年齢) */
  startYears: number;
  startMonths: number;
  /** 第1〜第10大運(概ね100歳分) */
  pillars: TaiunPillar[];
}

const MS_PER_DAY = 24 * 3600_000;

/** 出生時刻の前後の節入り時刻を探す(年跨ぎ対応) */
function adjacentSetsuiri(birthEpoch: number, direction: "next" | "prev"): Date | null {
  const jst = new Date(birthEpoch + 9 * 3600_000);
  const baseYear = jst.getUTCFullYear();
  const candidates: Date[] = [];
  for (const y of [baseYear - 1, baseYear, baseYear + 1]) {
    for (const name of SETSU_NAMES as readonly SetsuName[]) {
      const d = setsuiriOf(y, name);
      if (d) candidates.push(d);
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  if (direction === "next") {
    return candidates.find((d) => d.getTime() > birthEpoch) ?? null;
  }
  return [...candidates].reverse().find((d) => d.getTime() <= birthEpoch) ?? null;
}

/**
 * 大運を計算する。
 * @param birthDate DBの慣例どおりUTC深夜の暦日
 * @param birthTime "HH:mm"(未入力なら正午とみなす。立運が最大±4ヶ月ズレるため要注意)
 * @param gender "male" | "female"(それ以外はnull)
 */
export function calculateTaiun(
  birthDate: Date,
  birthTime: string | null | undefined,
  gender: string | null | undefined
): TaiunResult | null {
  if (gender !== "male" && gender !== "female") return null;

  const fp = calculateFourPillars(birthDate, birthTime);
  const yearStemYang = fp.year.index % 10 % 2 === 0; // 甲丙戊庚壬=陽
  const forward = (yearStemYang && gender === "male") || (!yearStemYang && gender === "female");

  // 出生の絶対時刻(JST壁時計)を構築
  const m = jstMomentOf(birthDate);
  const timeMatch = birthTime?.match(/^(\d{1,2}):(\d{2})$/);
  const hour = timeMatch ? Number(timeMatch[1]) : 12;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const birthEpoch = Date.UTC(m.year, m.month - 1, m.day, hour - 9, minute);

  const boundary = adjacentSetsuiri(birthEpoch, forward ? "next" : "prev");
  if (!boundary) return null; // 節入りテーブル範囲外(1900年以前・2100年以降)

  // 立運: 3日=1年、余り1日=4ヶ月(端数日は切り捨て。分単位の精密化は要監修確認)
  const diffDays = Math.abs(boundary.getTime() - birthEpoch) / MS_PER_DAY;
  const startYears = Math.floor(diffDays / 3);
  const startMonths = Math.floor((diffDays % 3) * 4);

  const dayStem = fp.day.index % 10;
  const pillars: TaiunPillar[] = [];
  for (let i = 1; i <= 10; i++) {
    const idx = (((fp.month.index + (forward ? i : -i)) % 60) + 60) % 60;
    pillars.push({
      index: idx,
      stem: JIKKAN[idx % 10],
      branch: JUNISHI[idx % 12],
      startAgeYears: startYears + (i - 1) * 10,
      startAgeMonths: startMonths,
      shusei: shuseiOf(dayStem, idx % 10),
      juusei: juuseiOf(dayStem, idx % 12),
    });
  }

  return { forward, startYears, startMonths, pillars };
}
