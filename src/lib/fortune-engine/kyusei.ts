/**
 * 九星気学(簡易実装・要件⑤ 2026-07-08で追加)
 *
 * ⚠️ 暫定実装: 正式な九星気学は立春を年の切り替わりとし、日家九星は
 * 冬至・夏至を挟む陽遁・陰遁で進行方向が反転する。ここでは
 * グレゴリオ暦ベースの簡易近似(年=1/1切替、日=通日の9循環)にしている。
 * → CEO占術監修(CEO1)で流派を確定後、正式な暦計算へ差し替え推奨(四柱推命と同方針)。
 */

export const KYUSEI_STARS = [
  "一白水星", "二黒土星", "三碧木星", "四緑木星", "五黄土星",
  "六白金星", "七赤金星", "八白土星", "九紫火星",
] as const;
export type KyuseiStar = (typeof KYUSEI_STARS)[number];

type Gogyo = "木" | "火" | "土" | "金" | "水";

/** 各星の五行(九星気学の標準対応) */
const STAR_ELEMENT: Record<KyuseiStar, Gogyo> = {
  一白水星: "水",
  二黒土星: "土",
  三碧木星: "木",
  四緑木星: "木",
  五黄土星: "土",
  六白金星: "金",
  七赤金星: "金",
  八白土星: "土",
  九紫火星: "火",
};

/** 本命星: 生まれ年から算出(西暦の各桁和を一桁化し、11から引く。0以下は+9) */
export function honmeisei(birthDate: Date): KyuseiStar {
  let n = birthDate.getFullYear();
  let digitSum = 0;
  while (n > 0) {
    digitSum += n % 10;
    n = Math.floor(n / 10);
  }
  while (digitSum > 9) {
    digitSum = String(digitSum).split("").reduce((a, b) => a + Number(b), 0);
  }
  let star = 11 - digitSum;
  if (star > 9) star -= 9;
  if (star <= 0) star += 9;
  return KYUSEI_STARS[star - 1];
}

const EPOCH = Date.UTC(2000, 0, 1); // 2000/1/1を一白水星の日とする簡易基準
const MS_PER_DAY = 86_400_000;

/** 日家九星: その日を司る星(通日の9循環による簡易近似) */
export function dailyStar(date: Date): KyuseiStar {
  const days = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / MS_PER_DAY);
  return KYUSEI_STARS[((days % 9) + 9) % 9];
}

/**
 * 本命星×日家九星の相性スコア(0-100)。
 * 五行の生剋関係で判定: 日の星が本命星を生む=最良 / 本命星が剋される=厳しい。
 * 同会(同じ星の日)は「自分の星が巡る特別な日」としてやや強めの好日扱い。
 */
export function kyuseiDayScore(user: KyuseiStar, day: KyuseiStar): number {
  if (user === day) return 78;
  const order: Gogyo[] = ["木", "火", "土", "金", "水"];
  const u = order.indexOf(STAR_ELEMENT[user]);
  const d = order.indexOf(STAR_ELEMENT[day]);
  const diff = (d - u + 5) % 5;
  if (diff === 0) return 66; // 比和(別の星だが同じ五行)
  if (diff === 4) return 90; // 日が本命を生む(相生・最良)
  if (diff === 1) return 58; // 本命が日を生む(気を使う日)
  if (diff === 3) return 72; // 本命が日を剋す(攻めが通る)
  return 36; // 日が本命を剋す(守りの日)
}

export interface KyuseiSummary {
  userStar: KyuseiStar;
  dayStarName: KyuseiStar;
  score: number; // 0-100
}

export function calculateKyusei(birthDate: Date, targetDate: Date): KyuseiSummary {
  const userStar = honmeisei(birthDate);
  const dayStarName = dailyStar(targetDate);
  return { userStar, dayStarName, score: kyuseiDayScore(userStar, dayStarName) };
}
