/**
 * ホロスコープ（西洋占星術・太陽星座の判定）
 * 星座の日付範囲は天文学的に確定した値のため、これは暫定ではなく正式ロジック。
 */

const ZODIAC_SIGNS = [
  { name: "牡羊座", start: [3, 21], end: [4, 19] },
  { name: "牡牛座", start: [4, 20], end: [5, 20] },
  { name: "双子座", start: [5, 21], end: [6, 21] },
  { name: "蟹座", start: [6, 22], end: [7, 22] },
  { name: "獅子座", start: [7, 23], end: [8, 22] },
  { name: "乙女座", start: [8, 23], end: [9, 22] },
  { name: "天秤座", start: [9, 23], end: [10, 23] },
  { name: "蠍座", start: [10, 24], end: [11, 22] },
  { name: "射手座", start: [11, 23], end: [12, 21] },
  { name: "山羊座", start: [12, 22], end: [1, 19] },
  { name: "水瓶座", start: [1, 20], end: [2, 18] },
  { name: "魚座", start: [2, 19], end: [3, 20] },
] as const;

export interface HoroscopeResult {
  sign: string;
  keyword: string;
}

const KEYWORDS: Record<string, string> = {
  牡羊座: "行動が運を呼ぶ日。迷ったら先に動いた方がうまくいく",
  牡牛座: "五感を大事にする日。心地よいと感じる選択が正解になりやすい",
  双子座: "情報が鍵になる日。誰かとの会話にヒントが隠れている",
  蟹座: "身近な人との時間が運気を底上げする日",
  獅子座: "自分を主役にして良い日。遠慮すると運気を逃す",
  乙女座: "細部への気配りが評価される日",
  天秤座: "バランス感覚が冴える日。両方選ぶ選択肢を探してみる",
  蠍座: "本音で向き合うことで物事が動き出す日",
  射手座: "行動範囲を広げるほど運が開ける日",
  山羊座: "コツコツ続けてきたことに結果が出やすい日",
  水瓶座: "個性を出すことを恐れなくて良い日",
  魚座: "直感を信じて良い日。理屈より感覚を優先すると良い",
};

export function calculateHoroscope(birthDate: Date): HoroscopeResult {
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();

  for (const z of ZODIAC_SIGNS) {
    const [sm, sd] = z.start;
    const [em, ed] = z.end;
    if (sm === em) {
      if (month === sm && day >= sd && day <= ed) return { sign: z.name, keyword: KEYWORDS[z.name] };
    } else if (sm > em) {
      // 年またぎ(山羊座)
      if ((month === sm && day >= sd) || (month === em && day <= ed)) {
        return { sign: z.name, keyword: KEYWORDS[z.name] };
      }
    } else {
      if ((month === sm && day >= sd) || (month === em && day <= ed) || (month > sm && month < em)) {
        return { sign: z.name, keyword: KEYWORDS[z.name] };
      }
    }
  }
  return { sign: "不明", keyword: "" };
}
