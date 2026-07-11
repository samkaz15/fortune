/**
 * 占術根拠(グラウンディング)モジュール(要件6・リニューアル計画 2026-07-11)
 *
 * 「なぜその助言になるのか」を占術用語で明示するための根拠文を生成する。
 * マーケティングレポート01章の「AI占い=コールドリーディングの自動化」という
 * 信頼性懸念への直接対策(根拠の明示は信頼構築に直結する)。
 *
 * ⚠️ 暦は既存モジュールと同じ簡易近似(節入りはrekichuu.tsの固定日近似)。
 * CEO占術監修(CEO1)で正式な暦計算へ差し替える方針は他モジュールと共通。
 */
import { JUNISHI, stemBranchIndexFromDate, calculateShichu } from "./shichu";
import { setsuMonth } from "./rekichuu";
import { calculateKyusei } from "./kyusei";
import { deriveSanmeiProfile } from "./sanmei-dictionary";

/**
 * 天中殺(空亡)の支ペア。生まれ日の干支番号(0-59)を10日ごとの旬に分け、
 * 各旬で「回ってこない2支」が天中殺となる(甲子旬=戌亥天中殺、以下標準対応)。
 */
const TENCHUSATSU_PAIRS: [number, number][] = [
  [10, 11], // 甲子旬 → 戌亥
  [8, 9],   // 甲戌旬 → 申酉
  [6, 7],   // 甲申旬 → 午未
  [4, 5],   // 甲午旬 → 辰巳
  [2, 3],   // 甲辰旬 → 寅卯
  [0, 1],   // 甲寅旬 → 子丑
];

export interface TenchusatsuInfo {
  pair: [string, string]; // 例: ["戌", "亥"]
  isTodayTenchusatsu: boolean; // 対象日の支が空亡支に該当(日の天中殺)
}

export function calcTenchusatsu(birthDate: Date, targetDate: Date): TenchusatsuInfo {
  const birthIdx = stemBranchIndexFromDate(birthDate);
  const [a, b] = TENCHUSATSU_PAIRS[Math.floor(birthIdx / 10)];
  const dayBranch = stemBranchIndexFromDate(targetDate) % 12;
  return {
    pair: [JUNISHI[a], JUNISHI[b]],
    isTodayTenchusatsu: dayBranch === a || dayBranch === b,
  };
}

/** 月破: その日の支が節月の月建(寅月=寅…)と冲(真向かい)の関係にある日 */
export function isGeppa(targetDate: Date): boolean {
  const monthBranchIdx = (setsuMonth(targetDate) + 1) % 12; // 節月1(寅月)→寅=index2
  const dayBranchIdx = stemBranchIndexFromDate(targetDate) % 12;
  return (dayBranchIdx - monthBranchIdx + 12) % 12 === 6;
}

export interface FortuneGrounding {
  /** 箇条書き用の根拠文(占術用語+平易な補足) */
  lines: string[];
  /** 天中殺・月破など「慎重に」系の要素が今日あるか(トーン調整用) */
  hasCautionSign: boolean;
}

/**
 * その日の占術根拠を、5占術の実際の計算値から組み立てる。
 * 各文は「占術用語(なぜ)→ 行動レベルの意味(だからどうする)」の順で書く。
 */
export function buildGrounding(birthDate: Date, targetDate: Date): FortuneGrounding {
  const lines: string[] = [];
  let hasCautionSign = false;

  // 四柱推命: 日柱の巡り(命式との相性)
  const day = calculateShichu(birthDate, targetDate, "day");
  const self = calculateShichu(birthDate, birthDate, "day");
  lines.push(
    `四柱推命では、あなたの日主「${self.dayStem}(${self.element})」に対して今日は「${day.dayStem}${day.dayBranch}」の日。命式との噛み合いから、運気の波は${day.wave}/100と読めます。`
  );

  // 算命学: 主星+天中殺
  const sanmei = deriveSanmeiProfile(birthDate);
  const ten = calcTenchusatsu(birthDate, targetDate);
  if (ten.isTodayTenchusatsu) {
    hasCautionSign = true;
    lines.push(
      `算命学では、今日はあなたの天中殺(${ten.pair[0]}${ten.pair[1]})に当たる日。新しい契約や開始事より、続けてきたことの手入れに向く日です。`
    );
  } else {
    lines.push(
      `算命学では、あなたの主星は「${sanmei.starName}」。天中殺(${ten.pair[0]}${ten.pair[1]})には当たらない通常運の日なので、主星の持ち味をそのまま使えます。`
    );
  }

  // 九星気学: 日盤の中宮
  const kyusei = calculateKyusei(birthDate, targetDate);
  lines.push(
    `九星気学では、今日は${kyusei.dayStarName}が中宮に位置する日。あなたの本命星「${kyusei.userStar}」から見て${kyusei.score >= 66 ? "気を受け取りやすい配置で、外から来る流れが味方します" : kyusei.score <= 40 ? "気が剋される配置なので、守りを固めるほど安定します" : "可もなく不可もない配置で、実力どおりが出る日です"}。`
  );

  // 暦注: 月破
  if (isGeppa(targetDate)) {
    hasCautionSign = true;
    lines.push(
      `暦の上では、今日は月破に位置しています。物事が「破れやすい」とされる日なので、大事な約束は確認をひとつ増やすと安心です。`
    );
  }

  return { lines, hasCautionSign };
}
