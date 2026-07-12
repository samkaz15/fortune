/**
 * マルチインデックス統合層 (CEO指示 2026-07-12: 10指標で「より確率の高い占い」)
 *
 * 10指標: 四柱推命・算命学・姓名判断・九星気学(既存4) +
 *         MBTI・カバラ数秘術・現代数秘術・動物アーキタイプ・紫微斗数(簡易)・東洋思想=五行バランス(新6)
 *
 * 役割: 各エンジンの決定論的な計算結果を1つの構造体(MultiIndexReading)に束ね、
 * LLM(チャット・レポート・無料鑑定)へ「根拠の束」として渡す。
 * 設計原則: ①各指標は独立に計算(1つ欠けても他は出る) ②LLMには生スコアでなく
 * キーワード・型名を渡す ③指標間の「一致」と「矛盾」を機械抽出してLLMに明示する
 * (一致=断定の根拠を強くする / 矛盾=「バグの解剖」の材料にする — Layer0思想)。
 */
import { calculateFourPillars } from "./shichu";
import { calculateSanmei } from "./sanmei";
import { calculateSeimei } from "./seimei";
import { calculateKyusei } from "./kyusei";
import { calculateNumerology } from "./indexes/numerology";
import { interpretMbti } from "./indexes/mbti";
import { calculateAnimal, calculateGogyoBalance } from "./indexes/animal-gogyo";
import { calculateShibi } from "./indexes/shibi";

export interface MultiIndexReading {
  shichu: { dayPillar: string; yearPillar: string; monthPillar: string; hourPillar: string | null };
  sanmei: { mainStar: string; yearStar: string; dayJuusei: string; orientation: string };
  seimei: { soukaku: number; jinkaku: number; score: number } | null;
  kyusei: { userStar: string } | null;
  numerology: { modern: number; kabbalah: number; keywords: string[] };
  mbti: { type: string; group: string; keywords: string[] } | null;
  animal: { animal: string; keywords: string[] };
  shibi: { meiguu: string; shinguu: string; keywords: string[] } | null;
  gogyo: { dominant: string; lacking: string | null; advice: string };
  /** 指標間で重なった性質キーワード(断定の強い根拠になる) */
  convergence: string[];
  /** 利用できた指標数(/10)。LLMに「根拠の厚み」として渡す */
  indexCount: number;
}

export function buildMultiIndexReading(params: {
  birthDate: Date;
  birthTime?: string | null;
  familyName?: string | null;
  givenName?: string | null;
  mbtiType?: string | null;
  targetDate?: Date;
}): MultiIndexReading {
  const { birthDate, birthTime, familyName, givenName, mbtiType } = params;
  const targetDate = params.targetDate ?? new Date();

  const fp = calculateFourPillars(birthDate, birthTime);
  const sanmei = calculateSanmei(birthDate, birthTime);
  const seimei = familyName && givenName ? calculateSeimei(familyName, givenName) : null;
  let kyusei: { userStar: string } | null = null;
  try {
    const k = calculateKyusei(birthDate, targetDate);
    kyusei = { userStar: k.userStar };
  } catch {
    kyusei = null; // 九星計算が失敗しても他の指標は返す
  }
  const numerology = calculateNumerology(birthDate);
  const mbti = interpretMbti(mbtiType);
  const animal = calculateAnimal(birthDate, birthTime);
  const shibi = calculateShibi(birthDate, birthTime);
  const gogyo = calculateGogyoBalance(birthDate, birthTime);

  // ---- 収束(convergence)抽出: 複数指標で重なるキーワードを機械検出 ----
  const keywordSets: string[][] = [
    numerology.keywordsModern,
    mbti?.keywords ?? [],
    animal.keywords,
    shibi?.keywords ?? [],
  ];
  const counts = new Map<string, number>();
  for (const set of keywordSets) {
    for (const kw of new Set(set)) counts.set(kw, (counts.get(kw) ?? 0) + 1);
  }
  const convergence = [...counts.entries()].filter(([, c]) => c >= 2).map(([kw]) => kw);

  const available = [true, true, Boolean(seimei), Boolean(kyusei), true, true, Boolean(mbti), true, Boolean(shibi), true];

  return {
    shichu: {
      dayPillar: fp.day.stem + fp.day.branch,
      yearPillar: fp.year.stem + fp.year.branch,
      monthPillar: fp.month.stem + fp.month.branch,
      hourPillar: fp.hour ? fp.hour.stem + fp.hour.branch : null,
    },
    sanmei: {
      mainStar: sanmei.mainStar,
      yearStar: sanmei.yearStar,
      dayJuusei: sanmei.dayJuusei,
      orientation: sanmei.orientation,
    },
    seimei: seimei ? { soukaku: seimei.soukaku, jinkaku: seimei.jinkaku, score: seimei.score } : null,
    kyusei,
    numerology: {
      modern: numerology.lifePathModern,
      kabbalah: numerology.lifePathKabbalah,
      keywords: numerology.keywordsModern,
    },
    mbti,
    animal: { animal: animal.animal, keywords: animal.keywords },
    shibi: shibi ? { meiguu: shibi.meiguu, shinguu: shibi.shinguu, keywords: shibi.keywords } : null,
    gogyo: { dominant: gogyo.dominant, lacking: gogyo.lacking, advice: gogyo.advice },
    convergence,
    indexCount: available.filter(Boolean).length,
  };
}
