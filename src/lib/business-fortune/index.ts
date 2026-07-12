/**
 * ビジネス占いエンジン (GM9調査・優先度最高の実装 / 2026-07-12)
 *
 * GM9(拡張占術コンテンツ調査)の推奨3コンテンツ:
 *  ① 勝負所カレンダー — 本人の日干×日々の干支の五行相性 + 暦注下段(吉日)で、
 *     商談・契約・決断に向く日を月単位で抽出する
 *  ② ビジネスパートナー相性 — 四柱の五行相性(日干同士)+ 姓名判断(人格)の複合
 *  ③ 独立・転職タイミング診断 — 大運の切替年と現在大運の性質(十大主星)から時期観を出す
 *
 * すべて決定論的計算(LLM不使用)。文章化はチャット/レポート側のLLM層が担う。
 * 「データ的根拠+AI分析ならビジネス層に受け入れられる」というGM9のインサイトに従い、
 * 出力には必ず根拠フィールド(reason)を付ける。
 */
import { stemBranchIndexFromDate, calculateFourPillars, JIKKAN, JUNISHI } from "@/lib/fortune-engine/shichu";
import { calculateSeimei } from "@/lib/fortune-engine/seimei";
import { calculateTaiun } from "@/lib/fortune-engine/taiun";
import { calcRekichuu } from "@/lib/fortune-engine/rekichuu";
import { tsuhenseiOf } from "@/lib/fortune-engine/tsuhensei";

const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4] as const; // 木木火火土土金金水水

/** 五行の関係: 0=同気 1=相生(自→他) 2=相剋(自→他) 3=被剋 4=被生 */
function elementRelation(mine: number, other: number): number {
  return (((other - mine) % 5) + 5) % 5;
}

// ---------------- ① 勝負所カレンダー ----------------

export interface ShoubuDay {
  date: string; // YYYY-MM-DD
  rating: "best" | "good" | "caution";
  kichijitsu: string[]; // 暦注の吉日名(一粒万倍日等)
  reason: string;
  bestFor: string[]; // 商談 | 契約 | 決断 | 仕込み
}

/**
 * 指定月の「勝負所」を抽出する。
 * 判定: 本人の日干から見た当日の日干の通変星(財・官=攻めの日、印=学び、比劫=仕込み)
 *       + 暦注の吉日が重なる日をbestに昇格、凶日はcautionに降格。
 */
export function buildShoubuCalendar(birthDate: Date, year: number, month: number): ShoubuDay[] {
  const myDayStem = stemBranchIndexFromDate(birthDate) % 10;
  const days: ShoubuDay[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let d = 1; d <= last; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const dayStem = stemBranchIndexFromDate(date) % 10;
    const star = tsuhenseiOf(myDayStem, dayStem);
    const rekichuu = calcRekichuu(date);
    const kichijitsu = rekichuu.good ?? [];
    const kyou = rekichuu.bad ?? [];

    let rating: ShoubuDay["rating"] | null = null;
    let bestFor: string[] = [];
    let reason = "";

    if (star === "偏財" || star === "正財") {
      rating = "good";
      bestFor = ["商談", "価格交渉"];
      reason = `あなたの日干から見て「財」が巡る日(${JIKKAN[dayStem]}の日)。お金と成果に直結する動きが通りやすい`;
    } else if (star === "正官" || star === "偏官") {
      rating = "good";
      bestFor = ["契約", "決断", "対外発表"];
      reason = `「官」が巡る日(${JIKKAN[dayStem]}の日)。責任を取る決断・公式な約束事に向く`;
    } else if (star === "食神" || star === "傷官") {
      rating = "good";
      bestFor = ["企画", "プレゼン", "発信"];
      reason = `表現の星が巡る日(${JIKKAN[dayStem]}の日)。アウトプットが冴える`;
    } else if (star === "比肩" || star === "劫財") {
      bestFor = ["仕込み", "根回し"];
      reason = "自分の気が強まる日。攻めより足場固め・準備に向く";
    } else {
      bestFor = ["学び", "情報収集"];
      reason = "吸収の日。判断材料を集めるのに向く";
    }

    // 暦注で昇格・降格
    if (kichijitsu.length > 0 && (rating === "good" || bestFor.includes("仕込み"))) {
      rating = "best";
      reason += `。さらに暦の吉日(${kichijitsu.join("・")})が重なる`;
    }
    if (kyou.length > 0) {
      rating = "caution";
      reason = `暦の上で${kyou.join("・")}にあたる日。新規の大きな約束は避け、既存案件の推進に留める`;
    }

    if (rating) {
      days.push({ date: date.toISOString().slice(0, 10), rating, kichijitsu, reason, bestFor });
    }
  }
  return days;
}

// ---------------- ② ビジネスパートナー相性 ----------------

export interface PartnerCompatibility {
  score: number; // 0-100
  dynamics: string; // 力学の型
  strengths: string;
  cautions: string;
  reason: string; // 占術根拠
}

export function businessPartnerCompatibility(params: {
  myBirthDate: Date;
  myFamilyName?: string | null;
  myGivenName?: string | null;
  partnerBirthDate: Date;
  partnerFamilyName?: string | null;
  partnerGivenName?: string | null;
}): PartnerCompatibility {
  const myStem = stemBranchIndexFromDate(params.myBirthDate) % 10;
  const partnerStem = stemBranchIndexFromDate(params.partnerBirthDate) % 10;
  const rel = elementRelation(STEM_ELEMENT[myStem], STEM_ELEMENT[partnerStem]);

  const DYNAMICS: Record<number, { base: number; dynamics: string; strengths: string; cautions: string }> = {
    0: { base: 68, dynamics: "同志型", strengths: "価値観と速度感が揃いやすく、初動が速い", cautions: "強みも弱みも同じ方向に偏る。外部の異質な視点を意識的に入れること" },
    1: { base: 82, dynamics: "あなたが育てる型", strengths: "あなたの投資・支援が相手の成果として花開く。長期の座組に強い", cautions: "与えすぎに注意。役割と対価の線引きを先に決めること" },
    2: { base: 74, dynamics: "あなたが主導する型", strengths: "あなたが方向を決め、相手が実行する分業が機能する", cautions: "主導が強すぎると相手が疲弊する。決定権の一部を明確に渡すこと" },
    3: { base: 62, dynamics: "相手に鍛えられる型", strengths: "相手の要求水準があなたを成長させる。緊張感のある良い座組にできる", cautions: "対等な契約条件を最初に固めないと、力関係が一方的になりやすい" },
    4: { base: 80, dynamics: "相手に支えられる型", strengths: "相手のリソース・信用があなたの推進力になる", cautions: "依存しすぎない。自前の武器を並行して磨くこと" },
  };
  const d = DYNAMICS[rel];

  // 姓名(人格)の補正: 両者の名前が揃っていれば±10
  let seimeiAdj = 0;
  let seimeiNote = "";
  if (params.myFamilyName && params.myGivenName && params.partnerFamilyName && params.partnerGivenName) {
    const mine = calculateSeimei(params.myFamilyName, params.myGivenName);
    const theirs = calculateSeimei(params.partnerFamilyName, params.partnerGivenName);
    const diff = Math.abs((mine.jinkaku % 10) - (theirs.jinkaku % 10));
    seimeiAdj = diff <= 2 ? 8 : diff >= 7 ? -6 : 0;
    seimeiNote = seimeiAdj > 0 ? "。姓名の人格も響き合う組み合わせ" : seimeiAdj < 0 ? "。姓名の人格は距離があるため、言語化と文書化を怠らないこと" : "";
  }

  const score = Math.max(30, Math.min(96, d.base + seimeiAdj));
  return {
    score,
    dynamics: d.dynamics,
    strengths: d.strengths,
    cautions: d.cautions,
    reason: `あなた(${JIKKAN[myStem]})と相手(${JIKKAN[partnerStem]})の日干の五行関係=${d.dynamics}${seimeiNote}`,
  };
}

// ---------------- ③ 独立・転職タイミング診断 ----------------

export interface TimingDiagnosis {
  currentPhase: string; // 現在の大運の性質
  nextShiftAge: number | null; // 次の大運切替の満年齢
  nextShiftYear: number | null;
  recommendation: "attack" | "prepare" | "hold";
  reason: string;
}

const ATTACK_STARS = ["貫索星", "車騎星", "龍高星"]; // 独立・変革向きの大運
const PREPARE_STARS = ["石門星", "禄存星", "鳳閣星", "調舒星"];

export function independenceTiming(birthDate: Date, birthTime: string | null | undefined, gender: string | null | undefined): TimingDiagnosis | null {
  const taiun = calculateTaiun(birthDate, birthTime, gender);
  if (!taiun) return null;

  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
  const current = taiun.pillars.find((p) => p.startAgeYears <= age && age < p.startAgeYears + 10);
  const next = taiun.pillars.find((p) => p.startAgeYears > age);
  if (!current) return null;

  const birthYear = birthDate.getUTCFullYear();
  let recommendation: TimingDiagnosis["recommendation"] = "hold";
  let reason = "";
  if (ATTACK_STARS.includes(current.shusei)) {
    recommendation = "attack";
    reason = `現在の10年運(${current.stem}${current.branch})は${current.shusei} — 自力・行動・変革の気が強く、独立や環境を変える挑戦が通りやすい時期`;
  } else if (PREPARE_STARS.includes(current.shusei)) {
    recommendation = "prepare";
    reason = `現在の10年運(${current.stem}${current.branch})は${current.shusei} — 仲間・表現・人望を育てる時期。今は独立の「準備」(顧客・実績・貯え)を固め、次の切替で動く設計が最適`;
  } else {
    recommendation = "hold";
    reason = `現在の10年運(${current.stem}${current.branch})は${current.shusei} — 組織・蓄積・学びが利く時期。今の場所で得られるものを取り切るのが先`;
  }
  if (next) {
    reason += `。次の流れの切替は${next.startAgeYears}歳(${birthYear + next.startAgeYears}年頃)、${next.shusei}の10年へ`;
  }

  return {
    currentPhase: `${current.stem}${current.branch}(${current.shusei}/${current.juusei})`,
    nextShiftAge: next?.startAgeYears ?? null,
    nextShiftYear: next ? birthYear + next.startAgeYears : null,
    recommendation,
    reason,
  };
}
