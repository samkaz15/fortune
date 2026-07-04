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
import { calculateShichu } from "@/lib/fortune-engine/shichu";
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

export interface DailyReportResult extends ReportContent {
  score: number;
  stars: number;
  scoreBreakdown: ScoreBreakdown;
  generatedBy: "llm" | "fallback";
}

interface ProfileInput {
  familyName: string;
  givenName: string;
  birthDate: Date;
}

function loadTaskPrompt(): string {
  try {
    return readFileSync(
      path.join(process.cwd(), "prompts", "chat", "decision_report_task.v1.0.md"),
      "utf-8"
    );
  } catch {
    return "今日の意思決定レポートを指定スキーマのJSONのみで出力してください。";
  }
}

export async function generateDailyReport(params: {
  userId: string;
  profile: ProfileInput;
  weather: WeatherContext | null;
  date?: Date;
}): Promise<DailyReportResult> {
  const { userId, profile, weather } = params;
  const date = params.date ?? new Date();

  // ---- ①占術シグナル抽出(4占術すべて・役割固定) ----
  const shichu = calculateShichu(profile.birthDate, date); // 運気の波・タイミング
  const sanmei = calculateSanmei(profile.birthDate); // ビジネス・才能
  const horoscope = calculateHoroscope(profile.birthDate); // 心理・感情
  const seimei = calculateSeimei(profile.familyName, profile.givenName); // 人間関係・社会運

  const fortuneKeyword = extractFortuneKeyword(shichu.advice);

  // ---- ②外部環境分析(気象→人間行動キーワード翻訳) ----
  const env: EnvironmentFeatures = analyzeEnvironment(weather, date);

  // ---- ③RAGテーマ抽出 ----
  const userTheme: UserThemeFeatures = await extractUserTheme(userId);

  // ---- ④ルールベーススコアリング ----
  const breakdown = calculateDailyScore({
    shichuWave: shichu.wave,
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
    signals: {
      timing: { wave: shichu.wave, advice: shichu.advice }, // 四柱推命→タイミング
      business: { orientation: sanmei.orientation, advice: sanmei.advice }, // 算命学→仕事
      psychology: { sign: horoscope.sign, keyword: horoscope.keyword }, // ホロスコープ→心理
      relationship: { score: seimei.score }, // 姓名判断→人間関係
    },
  };

  const content = await generateWithRetry(llmInput);
  if (content) {
    return { ...content, score: breakdown.final, stars: breakdown.stars, scoreBreakdown: breakdown, generatedBy: "llm" };
  }

  // ---- フォールバック(LLM失敗時。ユーザーにエラーを見せない) ----
  const fallback = buildFallbackReport(llmInput);
  return { ...fallback, score: breakdown.final, stars: breakdown.stars, scoreBreakdown: breakdown, generatedBy: "fallback" };
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
  stars: number;
  userTheme: string | null;
  recentTags: string[];
  recentConcerns: string[];
  environmentKeyword: string;
  environmentSupport: string[];
  fortuneKeyword: string;
  signals: unknown;
};

/** Sakana AI呼び出し(未設定時はnullを返しフォールバックへ)。1回だけリトライする */
async function generateWithRetry(input: LlmInput): Promise<ReportContent | null> {
  const endpoint = process.env.SAKANA_AI_API_ENDPOINT;
  const apiKey = process.env.SAKANA_AI_API_KEY;
  if (!endpoint || !apiKey) return null; // 開発環境はフォールバックを既定動作とする

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          system_prompt: `${CHARACTER_PROMPT}\n\n${loadTaskPrompt()}`,
          user_input: JSON.stringify(input),
          response_format: "json",
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw = typeof data === "string" ? data : (data.message ?? data.content ?? "");
      const parsed = reportSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
      if (parsed.success) return parsed.data;
    } catch {
      // リトライへ
    }
  }
  return null;
}

/**
 * フォールバックレポート(決定論的テンプレート)。
 * LLM未接続の開発環境・LLM障害時でも、仕様の6項目構造を完全に満たすレポートを返す。
 * トーンはCEO_STRAT(糸町の少年・常にポジティブ・決め打ち)に準拠。
 */
function buildFallbackReport(input: LlmInput): ReportContent {
  const theme = input.userTheme ?? input.fortuneKeyword;
  const band = input.score >= 80 ? "high" : input.score >= 50 ? "mid" : "low";

  const summaryByBand: Record<string, string> = {
    high: `今日は${input.score}点、追い風の一日だよ。「${theme}」に向き合ってきた君にとって、動くのに一番いいタイミングが来てる。${input.environmentKeyword}を感じる場面もあるかもしれないけど、それも君のペースを整えるサイン。迷っていたことがあるなら、今日それに一歩踏み出そう。大丈夫、必ずうまくいく。`,
    mid: `今日は${input.score}点、力を積み上げる一日だよ。「${theme}」というテーマに、焦らず着実に向き合うのに向いてる。${input.environmentKeyword}っぽい空気を感じたら、それは丁寧に進めるべきサイン。小さな一歩でも、今日の積み重ねが次の追い風につながる。大丈夫、必ずうまくいく。`,
    low: `今日は${input.score}点、自分の内側を整える一日だよ。「${theme}」について、静かに考えを深めるのにぴったりの日。${input.environmentKeyword}を感じやすいから、予定を詰め込みすぎず、余白を持って過ごそう。この時間も、なりたい自分に近づいてる証拠。大丈夫、必ずうまくいく。`,
  };

  const cautionsByBand: Record<string, [string, string, string]> = {
    high: ["勢い任せの約束", "確認せずの送信", "夜更かし"],
    mid: ["予定の詰め込みすぎ", "他人との比較", "衝動買い"],
    low: ["即決", "感情的な返信", "無理なスケジュール"],
  };

  const actionByBand: Record<string, string> = {
    high: `「${theme}」に関して迷っていたことを、今日1つだけ決めて動き出す`,
    mid: `「${theme}」のために、10分だけ準備の時間を取る`,
    low: `今日感じたことを3行だけメモして、明日の自分に残す`,
  };

  return {
    keywords: {
      userTheme: theme,
      environment: input.environmentKeyword,
      fortune: input.fortuneKeyword,
    },
    summary: summaryByBand[band],
    cautions: cautionsByBand[band],
    advice: `いま君が向き合っている「${theme}」は、ちゃんと前に進んでるよ。今日の空気は「${input.environmentKeyword}」、運気のキーワードは「${input.fortuneKeyword}」。この2つを合わせると、今日は自分のリズムを守りながら、決めたことを1つだけ確実にやり切る日。周りに流されず、君のペースで進めば大丈夫。`,
    todayAction: actionByBand[band],
  };
}
