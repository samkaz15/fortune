/**
 * 意思決定レポート ⑤LLM統合推論層 + 全層のオーケストレーション
 *
 * production_design.md §1 のフロー全体を実行するメインエントリーポイント。
 * ①〜④(決定論層)の結果を構造化してLLMに渡し、固定スキーマJSONを受け取る。
 * バリデーション失敗時は1回リトライ→フォールバック(ユーザーにエラーを見せない)。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { callClaudeJson } from "@/lib/llm/claude-client";
import { interpretDayStem } from "@/lib/fortune-engine/interpretation-dictionary";
import { calculateShichu } from "@/lib/fortune-engine/shichu";
import { calculateKyusei, KyuseiSummary } from "@/lib/fortune-engine/kyusei";
import { buildGrounding } from "@/lib/fortune-engine/grounding";
import { calculateSanmei } from "@/lib/fortune-engine/sanmei";
import { calculateHoroscope } from "@/lib/fortune-engine/horoscope";
import { calculateSeimei } from "@/lib/fortune-engine/seimei";
import { CHARACTER_PROMPT } from "@/lib/fortune-engine";
import { analyzeEnvironment, EnvironmentFeatures } from "./environment";
import { extractUserTheme, UserThemeFeatures } from "./knowledge";
import { calculateDailyScore, ScoreBreakdown } from "./scoring";
import type { WeatherContext } from "@/lib/weather";

// ---- 出力スキーマ(Zodで厳格に検証) ----
const reportSchema = z.object({
  // キーワード3つ(CEO_ENGINE_routing_v2 / v3レビューで意味を再定義。JSONキーは保存互換のため不変):
  //   fortune     = 「今日気をつける」(四柱推命由来・今日の運勢の注意)
  //   userTheme   = 「中長期の必要行動」(いま積むべき姿勢)
  //   environment = 「備えると良い」(備えておくと運が跳ねる項目)
  keywords: z.object({
    userTheme: z.string().min(1),
    environment: z.string().min(1),
    fortune: z.string().min(1),
  }),
  summary: z.string().min(100).max(300), // 150-250字指定だがLLMの揺れを考慮し100-300で受ける
  cautions: z.array(z.string().min(1)).length(3),
  advice: z.string().min(30),
  todayAction: z.string().min(5),
});

export type ReportContent = z.infer<typeof reportSchema>;

/** 理由付きの1項目(要件⑤ 2026-07-08: 「なぜそうなのか」まで必ず添える) */
export interface DetailItem {
  text: string;
  reason: string;
}

/** 内容拡充ブロック(要件⑤)。占術シグナルから決定論的に生成し、LLMの成否に依存しない */
export interface ReportDetails {
  grounding: string[]; // 占術根拠(天中殺・月破・中宮・命式など。要件6 2026-07-11)
  events: [DetailItem, DetailItem, DetailItem]; // 今日起こりやすい出来事
  cautionPoints: [DetailItem, DetailItem, DetailItem]; // 今日注意すること(理由付き)
  recommendations: [DetailItem, DetailItem, DetailItem]; // 今日おすすめの行動
  overview: string; // 今日の総評(200〜300字・前向きに締める)
}

export interface DailyReportResult extends ReportContent {
  score: number;
  stars: number;
  scoreBreakdown: ScoreBreakdown;
  details: ReportDetails;
  generatedBy: "llm" | "fallback";
}

interface ProfileInput {
  familyName: string;
  givenName: string;
  birthDate: Date;
}

function loadTaskPrompt(): string {
  // v1.2(2026-07-12): Layer0コンサル方針を反映した断定調・3部構成フレームワーク版。
  // 見つからない環境では旧v1.1へフォールバックする。
  for (const file of ["decision_report_task.v1.2.md", "decision_report_task.v1.1.md"]) {
    try {
      return readFileSync(path.join(process.cwd(), "prompts", "chat", file), "utf-8");
    } catch {
      /* 次の候補へ */
    }
  }
  return "今日の意思決定レポートを指定スキーマのJSONのみで出力してください。";
}

/** Layer0: CEO指示のコンサル方針(2026-07-12)。存在すればsystem promptの最上段に積む */
function loadConsultingPolicy(): string {
  try {
    return readFileSync(
      path.join(process.cwd(), "prompts", "consulting", "system_prompt.v2.0.md"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

export async function generateDailyReport(params: {
  userId: string;
  profile: ProfileInput;
  weather: WeatherContext | null;
  date?: Date;
  periodLabel?: string;
}): Promise<DailyReportResult> {
  const { userId, profile, weather } = params;
  const date = params.date ?? new Date();

  // ---- ①占術シグナル抽出(4占術すべて・役割固定) ----
  // periodLabelから期間種別を判定し、日運=日柱/週運=日柱/月運=月柱/年運=年柱で計算する(2026-07-07)
  const periodUnit: "day" | "week" | "month" | "year" =
    params.periodLabel === "今月" ? "month" : params.periodLabel === "来月" ? "month" : params.periodLabel === "今年" ? "year" : params.periodLabel === "今週" ? "week" : "day";
  const shichu = calculateShichu(profile.birthDate, date, periodUnit); // 運気の波・タイミング(期間種別対応)
  const sanmei = calculateSanmei(profile.birthDate); // ビジネス・才能
  const horoscope = calculateHoroscope(profile.birthDate); // 心理・感情
  const seimei = calculateSeimei(profile.familyName, profile.givenName); // 人間関係・社会運
  const kyusei = calculateKyusei(profile.birthDate, date); // 九星気学(要件⑤ 2026-07-08追加): 日々の巡り

  const fortuneKeyword = extractFortuneKeyword(shichu.advice);

  // ---- ②外部環境分析(気象→人間行動キーワード翻訳) ----
  const env: EnvironmentFeatures = analyzeEnvironment(weather, date);

  // ---- ③RAGテーマ抽出 ----
  const userTheme: UserThemeFeatures = await extractUserTheme(userId);

  // ---- ④ルールベーススコアリング ----
  const breakdown = calculateDailyScore({
    birthDate: profile.birthDate,
    targetDate: date,
    envModifier: env.scoreModifier,
    userTheme: userTheme.theme,
    fortuneKeyword,
  });

  // ---- ⑤LLM統合推論 ----
  const llmInput = {
    score: breakdown.final,
    stars: breakdown.stars,
    userTheme: userTheme.theme,
    recentTags: userTheme.recentTags,
    recentConcerns: userTheme.recentConcerns,
    environmentKeyword: env.keyword,
    environmentSupport: env.supportKeywords,
    fortuneKeyword,
    dayStem: shichu.dayStem,
    periodLabel: params.periodLabel ?? "今日",
    signals: {
      timing: { wave: shichu.wave, advice: shichu.advice }, // 四柱推命→タイミング
      business: { orientation: sanmei.orientation, advice: sanmei.advice }, // 算命学→仕事
      psychology: { sign: horoscope.sign, keyword: horoscope.keyword }, // ホロスコープ→心理
      relationship: { score: seimei.score }, // 姓名判断→人間関係
    },
  };

  // ---- ⑥内容拡充ブロック(要件⑤ 2026-07-08): LLMの成否に依存せず占術シグナルから決定論生成 ----
  const grounding = buildGrounding(profile.birthDate, date);
  const details = buildDailyDetails({
    grounding,
    periodLabel: params.periodLabel ?? "今日",
    score: breakdown.final,
    stem: interpretDayStem(shichu.dayStem),
    shichuAdvice: shichu.advice,
    horoscopeKeyword: horoscope.keyword,
    kyusei,
    branchHarmony: breakdown.branchHarmony,
    env,
    theme: userTheme.theme ?? fortuneKeyword,
  });

  const content = await generateWithRetry(llmInput);
  if (content) {
    return { ...content, score: breakdown.final, stars: breakdown.stars, scoreBreakdown: breakdown, details, generatedBy: "llm" };
  }

  // ---- フォールバック(LLM失敗時。ユーザーにエラーを見せない) ----
  const fallback = buildFallbackReport(llmInput);
  return { ...fallback, score: breakdown.final, stars: breakdown.stars, scoreBreakdown: breakdown, details, generatedBy: "fallback" };
}

/** shichuのadvice文から運勢キーワードを1語抽出する(決定論的マッピング) */
function extractFortuneKeyword(advice: string): string {
  if (advice.includes("行動力")) return "決断";
  if (advice.includes("育てる")) return "継続";
  if (advice.includes("足元")) return "準備";
  if (advice.includes("判断力")) return "決断";
  if (advice.includes("柔軟")) return "つながり";
  return "流れ";
}

type LlmInput = {
  score: number;
  periodLabel?: string;
  stars: number;
  dayStem?: string;
  userTheme: string | null;
  recentTags: string[];
  recentConcerns: string[];
  environmentKeyword: string;
  environmentSupport: string[];
  fortuneKeyword: string;
  signals: unknown;
};

/** LLM呼び出し(Claude APIに集約 2026-07-12)。未設定時はnullを返しフォールバックへ。1回だけリトライする */
async function generateWithRetry(input: LlmInput): Promise<ReportContent | null> {
  const parsed = await callClaudeJson(
    {
      systemPrompt: `${loadConsultingPolicy()}\n\n${CHARACTER_PROMPT}\n\n${loadTaskPrompt()}`.trim(),
      userInput: input,
      maxTokens: 1024,
    },
    (raw) => {
      const result = reportSchema.safeParse(raw);
      return result.success ? result.data : null;
    }
  );
  return parsed;
}


/**
 * 内容拡充ブロックの決定論生成(要件⑤ 2026-07-08)。
 * 「今日起こりやすい出来事」「注意すること」「おすすめの行動」各3つを理由付きで、
 * さらに200〜300字の総評を、九星気学・四柱推命(支の関係)・ホロスコープ・環境の
 * シグナルだけから組み立てる。乱数は使わず、日付×ユーザーで毎日内容が変わる。
 */
function buildDailyDetails(m: {
  grounding: { lines: string[]; hasCautionSign: boolean };
  periodLabel: string;
  score: number;
  stem: { state: string; description: string; action: string };
  shichuAdvice: string;
  horoscopeKeyword: string;
  kyusei: KyuseiSummary;
  branchHarmony: number;
  env: EnvironmentFeatures;
  theme: string;
}): ReportDetails {
  const { periodLabel: L, score, stem, kyusei, branchHarmony, env, theme } = m;
  const good = score >= 60;
  const kyuseiGood = kyusei.score >= 66;
  const harmony = branchHarmony >= 64;
  const clash = branchHarmony <= 36; // 冲(支がぶつかる日)

  const events: [DetailItem, DetailItem, DetailItem] = [
    kyuseiGood
      ? { text: "人からの声かけや紹介など、外から流れが入ってきやすい", reason: `${L}は${kyusei.dayStarName}が巡る日で、あなたの本命星「${kyusei.userStar}」を後押しする関係。外から来るものが味方につく配置です。` }
      : { text: "自分のペースを乱される小さな割り込みが入りやすい", reason: `${L}は${kyusei.dayStarName}の日で、本命星「${kyusei.userStar}」とはエネルギーの向きが揃わない配置。外からの流れに振り回されやすい分、自分の軸が試されます。` },
    harmony
      ? { text: "会話や相談が思った以上にスムーズに進みやすい", reason: `生まれ日の支と${L}の支が調和する巡り(支合・三合に近い関係)。相手との呼吸が合いやすく、まとまる話はまとまる日です。` }
      : clash
        ? { text: "予定の変更やすれ違いが起きやすい", reason: `生まれ日の支と${L}の支が正面からぶつかる「冲」に近い巡り。悪い日ではなく「予定が動く日」。変更前提で余白を持つと逆に得をします。` }
        : { text: "淡々と進む一方で、後回しにしていた用事が顔を出しやすい", reason: `支の巡りが可もなく不可もない中間の関係。大きな波がない分、溜まっていたものに手を付けるのに向いた流れです。` },
    good
      ? { text: `「${theme}」に関して、判断材料が揃う出来事がありそう`, reason: `総合スコア${score}点の追い風の${L}は、${stem.state}のあなたの型が素直に通ります。迷っていたことに答えを出すきっかけが来やすい日です。` }
      : { text: `「${theme}」について、一度立ち止まって考え直したくなる場面がありそう`, reason: `総合スコア${score}点と力を溜める側の${L}。${stem.description}流れが穏やかな日ほど、見直しの質は上がります。` },
  ];

  const cautionPoints: [DetailItem, DetailItem, DetailItem] = [
    clash
      ? { text: "大事な約束の「即決」は避ける", reason: "支がぶつかる巡りの日は、その場の空気で決めたことが後で動きやすいため。一晩置くだけで精度が大きく変わります。" }
      : { text: "予定の詰め込みすぎに注意", reason: `${L}の空気は「${env.keyword}」。余白のない計画は、この空気の日には小さなずれが連鎖しやすいためです。` },
    kyuseiGood
      ? { text: "来た話に乗るときこそ、条件の確認だけ丁寧に", reason: "外から流れが入る日は、良い話と紛らわしい話が同時に来ます。巡りが良い日ほど確認の一手間が効きます。" }
      : { text: "他人のペースに合わせすぎない", reason: `本命星「${kyusei.userStar}」と${L}の星の向きが揃わない日は、合わせるほど消耗します。自分の予定を先に置いてから応じるのが正解です。` },
    good
      ? { text: "勢いに任せた深夜の判断・送信は控える", reason: "追い風の日の唯一の落とし穴は「勢い余り」。夜は判断の精度が落ちるので、良い流れは翌朝に持ち越すほうが結果が良くなります。" }
      : { text: "自分への評価を今日決めない", reason: "運気の波が低めの日に下した自己評価は、実際より厳しく出ます。今日の停滞は実力ではなく巡りの問題です。" },
  ];

  const recommendations: [DetailItem, DetailItem, DetailItem] = [
    { text: `朝のうちに「${stem.action}」を5分だけ`, reason: `${stem.state}のあなたの型と${L}の流れが噛み合う動き方だからです。朝に置くと1日の消耗が減り、運気の通り道ができます。` },
    { text: m.horoscopeKeyword.split("。")[0], reason: `星回りから見た${L}のあなたの心理の回復スイッチがここにあります。気分が乗らない日ほど効きます。` },
    good
      ? { text: `「${theme}」でいちばん気になっている相手・場所に自分から一歩`, reason: `スコア${score}点の${L}は、踏み込んだ分だけ返ってくる配分。受け身で待つより、先に動いた人に流れが寄ります。` }
      : { text: "身の回りをひとつだけ整える(机・受信箱・予定表のどれか)", reason: "力を溜める日の開運行動は「整える」こと。次に波が上がったとき、すぐ動ける状態を作った人から順に運が回ってきます。" },
  ];

  const overview = good
    ? `${L}のあなたは${score}点、${stem.state}の力が素直に通る追い風の一日です。${kyuseiGood ? `${kyusei.dayStarName}の巡りが外からの流れを運んでくるので、来た話には条件確認だけ添えて乗ってみてください。` : `外の流れに頼らず、自分から仕掛けた動きがそのまま結果につながります。`}${clash ? "予定は動きやすい日なので、変更は「悪い知らせ」ではなく流れの調整だと受け取って大丈夫。" : "会話や相談はまとまりやすいので、後回しにしていた話を切り出すのにも向いています。"}夜は勢いを翌朝に持ち越す意識だけ忘れずに。今日のあなたなら、決めたことはちゃんと形になります。いい一日にしましょう。`
    : `${L}のあなたは${score}点、派手さより「整える」が効く一日です。${stem.description}${clash ? "支がぶつかる巡りで予定は動きやすいですが、それは流れの調整であって後退ではありません。" : `${kyuseiGood ? "外からの声かけには恵まれる日なので、受け取るものは受け取って大丈夫。" : "外に合わせるより自分のリズムを守るほうが消耗しません。"}`}今日の停滞に見えるものは、次の波のための助走です。朝の5分だけ「${stem.action}」に使って、あとは余白を持って過ごしてください。巡りは必ず戻ってきます。明日のあなたが楽になる準備を、今日のあなたがしてあげる日です。`;

  return { grounding: m.grounding.lines, events, cautionPoints, recommendations, overview };
}

/**
 * フォールバックレポート(決定論的テンプレート)。
 * LLM未接続の開発環境・LLM障害時でも、仕様の6項目構造を完全に満たすレポートを返す。
 * トーンはCEO_STRAT(錦糸町の少年・常にポジティブ・決め打ち)に準拠。
 */
function buildFallbackReport(input: LlmInput): ReportContent {
  const theme = input.userTheme ?? input.fortuneKeyword;
  // 評価トーン4帯(CEOフィードバック 2026-07-06):
  // high=いい評価 / challenge=勝負の日(一歩踏み込む) / mid=普通 / low=悪い評価(でも前向きに着地)
  // 2026-07-07: スコア分布を統計的相対評価(平均50・標準偏差16)に刷新したためしきい値を再設計
  const band = input.score >= 80 ? "high" : input.score >= 65 ? "challenge" : input.score >= 40 ? "mid" : "low";
  // 日干の解釈辞書(Core Mapping Spec)を織り込み、生年月日ごとに文面を変える
  const stem = interpretDayStem(input.dayStem ?? "戊");
  const L = input.periodLabel ?? "今日";

  const summaryByBand: Record<string, string> = {
    high: `${L}は${input.score}点、かなり追い風です。${stem.state}の力がいつもより強く出ているので、「${theme}」で迷っていたことは、動くならいちばんいいタイミング。周りのペースに合わせる必要はないです。午前のうちにひとつだけ決めてしまえば、今日は十分です。`,
    challenge: `${L}は${input.score}点。正直に言うと——${L}は勝負どころです。${stem.description}この流れは、待つより一歩踏み込んだ人に味方します。「${theme}」について、いつもより半歩だけ深く踏み込んでみてください。怖さが少しあるくらいが、ちょうどいい日です。`,
    mid: `${L}は${input.score}点。派手さはないですが、積み上げがそのまま効く日です。「${theme}」については、焦って進めるより${stem.action}のが正解。「${input.environmentKeyword}」っぽい空気を感じたら、それは丁寧に進むサインだと思ってください。ひとつ決めて、あとは淡々と。それで十分です。`,
    low: `${L}は${input.score}点。無理に攻める流れではないです、、が、内側を整えるにはすごくいい日です。${stem.state}のあなたにとって、こういう日は「${theme}」の土台を静かに固めるチャンス。予定は詰め込みすぎず、余白を持って過ごしてください。今日ゆっくり休むのも、ちゃんと前に進むことの一部です。`,
  };

  const cautionsByBand: Record<string, [string, string, string]> = {
    high: ["勢い任せの約束", "確認せずの送信", "夜更かし"],
    challenge: ["迷いすぎて時機を逃すこと", "他人の顔色を見すぎること", "深夜の考えごと"],
    mid: ["予定の詰め込みすぎ", "他人との比較", "衝動買い"],
    low: ["即決", "感情的な返信", "無理なスケジュール"],
  };

  const actionByBand: Record<string, string> = {
    high: `もし今日ひとつだけやるなら、「${theme}」で迷っていたことをひとつ決めて動き出すのがいいと思います`,
    challenge: `もし今日ひとつだけやるなら、「${theme}」でいちばん気になっている相手や場所に、自分から連絡を入れるのがいいと思います。今日は踏み込んだ分だけ返ってきます`,
    mid: `もし今日ひとつだけやるなら、「${theme}」のために10分だけ準備の時間を取るのがいいと思います`,
    low: `今日感じたことを3行だけメモして、明日の自分に残しておくのがいいと思います`,
  };

  return {
    keywords: {
      userTheme: theme,
      environment: input.environmentKeyword,
      fortune: input.fortuneKeyword,
    },
    summary: summaryByBand[band],
    cautions: cautionsByBand[band],
    advice: `いま向き合っている「${theme}」、ちゃんと前に進んでます。今日の空気は「${input.environmentKeyword}」、注意しておきたいのは「${input.fortuneKeyword}」。合わせると、今日は自分のリズムを守って、決めたことをひとつだけ確実にやり切る日です。それと——迷いが長引くのは決断力の問題じゃなくて、少し疲れているだけのことが多いです。`,
    todayAction: actionByBand[band],
  };
}
