/**
 * 姓名判断（画数占い）
 *
 * ⚠️ 実データ未整備の暫定実装:
 * 本来の姓名判断は「漢字ごとの正確な画数(旧字体基準)」を引く画数辞書が必要。
 * 現時点ではその辞書を持っていないため、文字のUnicodeコードポイントから
 * 決定論的に擬似画数を導出している(同じ名前なら常に同じ結果になる)。
 * → CEO占術監修(WBS: CEO1)で正式な画数辞書・流派(熊崎式 等)を確定した後、
 *   strokeCountOf() を辞書引きに差し替えること。これが唯一の要修正ポイント。
 */

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
}

/** 暫定の擬似画数関数。CEO監修後に正式な画数辞書へ差し替える。 */
function strokeCountOf(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  // 1〜24画の範囲に収まるよう決定論的にマッピング(実データではない)
  return (code % 24) + 1;
}

function sumStrokes(text: string): number {
  return Array.from(text).reduce((sum, ch) => sum + strokeCountOf(ch), 0);
}

export function calculateSeimei(familyName: string, givenName: string): SeimeiScore {
  const familyChars = Array.from(familyName);
  const givenChars = Array.from(givenName);

  const tenkaku = sumStrokes(familyName);
  const chikaku = sumStrokes(givenName);
  const jinkaku =
    strokeCountOf(familyChars[familyChars.length - 1] ?? "") +
    strokeCountOf(givenChars[0] ?? "");
  const soukaku = tenkaku + chikaku;
  const gaikaku = Math.max(1, soukaku - jinkaku);

  // 画数占いの伝統的な「吉数」に近いほど高スコアという簡易採点(暫定ロジック)
  const luckyRemainders = [1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 31, 32];
  const scoreOf = (n: number) => (luckyRemainders.includes(n % 32 || 32) ? 100 : 55);
  const score = Math.round(
    (scoreOf(tenkaku) + scoreOf(jinkaku) + scoreOf(chikaku) + scoreOf(gaikaku) + scoreOf(soukaku)) / 5
  );

  return { tenkaku, jinkaku, chikaku, gaikaku, soukaku, score };
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
