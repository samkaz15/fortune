/**
 * 姓名判断（熊崎式・五格剖象法）— D-1〜D-3正式化 (2026-07-12)
 *
 * 確定事項(CEO1監修シート):
 * - D-1: 熊崎式(五格剖象法)を採用
 * - D-2: 新字体入力 → 旧字体変換辞書(kyujitai-map.json 419件) → 画数辞書
 *        (kanji-strokes.json 3,199字・KANJIDIC2派生)で画数を引く
 * - D-3: 霊数を採用(一字姓→天格+1、一字名→地格+1。総格には含めない)
 * - D-4: 吉凶表は監修者データ待ち(kikkyou-table.json)。未提供の間は暫定採点にフォールバック
 *
 * 監修者レビュー対象(radical-adjustments.json / kana-strokes.json / seimei-review.json 参照):
 * 1. 康熙字典基準の部首画数補正(氵=4画等)は未適用。radical-adjustments.json に
 *    監修者提供の値を投入すれば辞書より優先して反映される。
 * 2. かなの画数表は流派差があるため全値レビュー対象。
 * 3. 霊数の適用範囲(外格の算式含む)。現実装: 外格 = 天格 + 地格 − 人格。
 * 4. 辞書に無い文字(異体字・外字)は旧来の擬似画数へフォールバックし、
 *    結果の unknownChars に列挙する(UI側で「参考値」表示に使える)。
 */
import kanjiStrokes from "./data/kanji-strokes.json";
import kyujitaiMap from "./data/kyujitai-map.json";
import kanaStrokes from "./data/kana-strokes.json";
import radicalAdjustments from "./data/radical-adjustments.json";
import kikkyouTable from "./data/kikkyou-table.json";

const KANJI: Record<string, number> = kanjiStrokes as Record<string, number>;
const KYUJITAI: Record<string, string> = kyujitaiMap as Record<string, string>;
const KANA: Record<string, number | string> = kanaStrokes as Record<string, number | string>;
const ADJUST: Record<string, number | string | object> = radicalAdjustments as Record<string, number | string | object>;
const KIKKYOU: Record<string, { rank: string; score: number } | string> = kikkyouTable as Record<string, { rank: string; score: number } | string>;

export interface SeimeiScore {
  /** 天格：姓の画数合計（家系運） */
  tenkaku: number;
  /** 人格：姓の最後の文字＋名の最初の文字（主運） */
  jinkaku: number;
  /** 地格：名の画数合計（前半生の運） */
  chikaku: number;
  /** 外格：総画−人格（対人運） */
  gaikaku: number;
  /** 総格：姓名の全画数合計（生涯運） */
  soukaku: number;
  /** 0-100に正規化した相性/総合スコア */
  score: number;
  /** 画数辞書に無く擬似画数でフォールバックした文字(空なら全字正式計算) */
  unknownChars: string[];
  /** 霊数を適用したか(一字姓・一字名) */
  reisuuApplied: { family: boolean; given: boolean };
}

/** 辞書に無い文字向けの旧擬似画数(フォールバック専用。unknownCharsに記録される) */
function pseudoStrokeOf(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  return (code % 24) + 1;
}

/**
 * 1文字の画数を引く(D-2)。優先順: 部首補正(監修者提供) > 旧字体変換→漢字辞書 > かな表 > フォールバック。
 * 「々」は直前の文字の画数(呼び出し側sumStrokesで処理)。
 */
function strokeCountOf(char: string, unknown?: string[]): number {
  const adjusted = ADJUST[char];
  if (typeof adjusted === "number") return adjusted; // 康熙部首補正(最優先)
  const target = KYUJITAI[char] ?? char; // 新字体→旧字体
  const fromKanji = KANJI[target] ?? KANJI[char];
  if (typeof fromKanji === "number") return fromKanji;
  const fromKana = KANA[char];
  if (typeof fromKana === "number") return fromKana;
  unknown?.push(char);
  return pseudoStrokeOf(char);
}

function sumStrokes(text: string, unknown?: string[]): number {
  const chars = Array.from(text);
  let sum = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "々" && i > 0) {
      sum += strokeCountOf(chars[i - 1], unknown); // 踊り字は直前文字の画数
    } else {
      sum += strokeCountOf(ch, unknown);
    }
  }
  return sum;
}

export function calculateSeimei(familyName: string, givenName: string): SeimeiScore {
  const familyChars = Array.from(familyName);
  const givenChars = Array.from(givenName);
  const unknownChars: string[] = [];

  const familySum = sumStrokes(familyName, unknownChars);
  const givenSum = sumStrokes(givenName, unknownChars);

  // D-3: 霊数(一字姓→天格に+1、一字名→地格に+1。総格には加えない)
  const reisuuFamily = familyChars.length === 1;
  const reisuuGiven = givenChars.length === 1;
  const tenkaku = familySum + (reisuuFamily ? 1 : 0);
  const chikaku = givenSum + (reisuuGiven ? 1 : 0);

  const jinkaku =
    strokeCountOf(familyChars[familyChars.length - 1] ?? "", unknownChars) +
    strokeCountOf(givenChars[0] ?? "", unknownChars);
  const soukaku = familySum + givenSum; // 霊数を含めない実画数の合計
  // 外格 = 天格 + 地格 − 人格(霊数なしの場合は 総格−人格 と一致する)
  const gaikaku = Math.max(1, tenkaku + chikaku - jinkaku);

  const score = Math.round(
    (kakusuScore(tenkaku) + kakusuScore(jinkaku) + kakusuScore(chikaku) + kakusuScore(gaikaku) + kakusuScore(soukaku)) / 5
  );

  return {
    tenkaku, jinkaku, chikaku, gaikaku, soukaku, score,
    unknownChars: [...new Set(unknownChars)],
    reisuuApplied: { family: reisuuFamily, given: reisuuGiven },
  };
}

/**
 * 画数→スコア(D-4)。監修者提供の kikkyou-table.json(1〜81画)があればそれを使い、
 * 未提供の間は暫定採点(吉数リスト)にフォールバックする。82画以上は80を引いて折り返す(慣例)。
 */
function kakusuScore(n: number): number {
  const normalized = n > 81 ? ((n - 1) % 80) + 1 : n;
  const entry = KIKKYOU[String(normalized)];
  if (entry && typeof entry === "object" && typeof entry.score === "number") {
    return entry.score;
  }
  // フォールバック: 暫定の吉数採点(監修データ投入後は自動的に使われなくなる)
  const luckyRemainders = [1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 31, 32];
  return luckyRemainders.includes(normalized % 32 || 32) ? 100 : 55;
}

/** 相性診断用：2人分の姓名判断スコアから相性%を算出する */
export function calculateCompatibilityFromNames(
  a: { familyName: string; givenName: string },
  b: { familyName: string; givenName: string }
): number {
  const scoreA = calculateSeimei(a.familyName, a.givenName);
  const scoreB = calculateSeimei(b.familyName, b.givenName);
  const diff = Math.abs(scoreA.soukaku - scoreB.soukaku);
  // 総格の差が小さいほど相性が高い、という簡易モデル(暫定)
  const compatibility = Math.max(30, 100 - diff * 2);
  return Math.round(compatibility);
}
