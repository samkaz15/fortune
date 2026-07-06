/**
 * Sakana AI 連携アダプタ
 *
 * 占術ロジック(seimei/shichu/sanmei/horoscope)が出した構造化データを、
 * 「糸町の少年」というキャラクターの口調で自然文に変換してもらうための層。
 * ドメインロジック(index.ts)からは常にこの関数だけを呼び、
 * 実際のAPI仕様変更の影響をここに閉じ込める(Data Access Layer的な考え方)。
 *
 * 分析層の基礎プロンプトは prompts/analysis/occult_analysis_base.v1.md(Layer 0)。
 * Sakana AI連携時は、まず分析層で客観分析(確信度付き)を行い、
 * その結果をキャラクター層(system_prompt v2.3)が「糸町の少年」の言葉に翻訳する2段構成にする。
 *
 * SAKANA_AI_API_KEY が未設定の開発環境では、モック応答にフォールバックする
 * (フロント/チャットの動作確認をAPIキーなしでも行えるようにするため)。
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export interface SakanaAIRequest {
  category: string;
  characterPrompt: string; // キャラクター口調プロンプト(Layer1)
  analysisPrompt?: string; // 占術分析の基礎プロンプト(Layer0)。2段構成の上流(UX8)
  signals: Record<string, unknown>; // 占術ロジックの出力一式
  userQuestion: string; // チャットでのユーザーの相談内容
}

export interface SakanaAIResponse {
  message: string; // チャット吹き出しとして表示する本文
  summary: string; // 結果画面の無料開放部分(要約)
  nextActions: [string, string, string]; // ネクストアクション3つ(GPT4の文字数制約に準拠させる)
  overallScore: number; // 0-100
}

const SAKANA_AI_ENDPOINT = process.env.SAKANA_AI_API_ENDPOINT ?? "";
const SAKANA_AI_API_KEY = process.env.SAKANA_AI_API_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/**
 * LLM呼び出しの3段フォールバック(CEO指示 2026-07-06):
 *   1. Sakana AI(キー+エンドポイント設定時)
 *   2. OpenAI(Sakana未設定または失敗時。コスト超過時のスイッチ先)
 *   3. 開発用モック(どちらも使えない時。サービスは止めない)
 */
export async function callSakanaAI(req: SakanaAIRequest): Promise<SakanaAIResponse> {
  if (SAKANA_AI_API_KEY && SAKANA_AI_ENDPOINT) {
    try {
      return await callSakanaAIRaw(req);
    } catch (e) {
      console.error("[llm] Sakana AI failed, falling back:", e instanceof Error ? e.message : e);
    }
  }
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAIFallback(req);
    } catch (e) {
      console.error("[llm] OpenAI fallback failed, using mock:", e instanceof Error ? e.message : e);
    }
  }
  return mockSakanaAIResponse(req);
}

async function callSakanaAIRaw(req: SakanaAIRequest): Promise<SakanaAIResponse> {
  const res = await fetch(SAKANA_AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SAKANA_AI_API_KEY}`,
    },
    body: JSON.stringify({
      // 2段構成(UX8): 分析層(Layer0)で客観分析→キャラ層(Layer1)が翻訳
      analysis_prompt: req.analysisPrompt ?? null,
      system_prompt: req.characterPrompt,
      category: req.category,
      signals: req.signals,
      user_question: req.userQuestion,
      // TODO: 実際のSakana AI APIの入出力スキーマが確定次第、ここを合わせる
    }),
    // Sakana AI呼び出しはユーザー体験をブロックしないよう、上位でタイムアウト制御すること
  });

  if (!res.ok) {
    throw new Error(`Sakana AI request failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    message: data.message,
    summary: data.summary,
    nextActions: data.next_actions,
    overallScore: data.overall_score,
  };
}

/**
 * OpenAI Chat Completionsによる予備応答(構造はSakanaAIResponseに揃える)。
 * 分析層(Layer0)+キャラ層(Layer1)のプロンプトを合成し、JSONで返させる。
 */
async function callOpenAIFallback(req: SakanaAIRequest): Promise<SakanaAIResponse> {
  const system = [
    req.analysisPrompt ?? "",
    req.characterPrompt,
    "",
    "# 出力形式(厳守)",
    '必ず次のJSONのみを返すこと: {"message": "チャット返信本文(キャラの言葉)", "summary": "1行要約", "next_actions": ["行動1", "行動2", "行動3"], "overall_score": 0-100の整数}',
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.8,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            category: req.category,
            signals: req.signals,
            user_question: req.userQuestion,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  if (!parsed.message || !parsed.summary || !Array.isArray(parsed.next_actions)) {
    throw new Error("OpenAI response schema mismatch");
  }
  return {
    message: String(parsed.message),
    summary: String(parsed.summary),
    nextActions: [
      String(parsed.next_actions[0] ?? ""),
      String(parsed.next_actions[1] ?? ""),
      String(parsed.next_actions[2] ?? ""),
    ],
    overallScore: Math.max(0, Math.min(100, Number(parsed.overall_score) || 50)),
  };
}

/** APIキー未設定時の開発用モック。占術ロジックの結果とネクストアクションテンプレート(GPT4→v2.0)を反映する。 */
function mockSakanaAIResponse(req: SakanaAIRequest): SakanaAIResponse {
  const wave = deriveScore(req.signals);
  const template = pickNextActionTemplate(wave);

  return {
    message:
      `そっか、話してくれてありがとう。${template.heading}だよ。` +
      `それって、なりたい自分にちゃんと近づいてるサインなんだ。` +
      `まずは「${template.actions[0]}」ってところから始めてみようよ。`,
    summary: `今日の運気は${wave}点。${template.heading}。`,
    nextActions: [template.actions[0], template.actions[1], template.actions[2]],
    overallScore: wave,
  };
}

/**
 * CEO1(占術カテゴリ別割当)により、カテゴリによって計算される占術が異なるため、
 * どの占術が来ても運気スコアとして扱えるようフォールバックチェーンで導出する。
 */
function deriveScore(signals: Record<string, unknown>): number {
  const shichu = signals.shichu as { wave?: number } | null;
  if (shichu?.wave !== undefined) return Math.round(shichu.wave);

  const sanmei = signals.sanmei as { stabilityScore?: number; entrepreneurialScore?: number } | null;
  if (sanmei?.stabilityScore !== undefined && sanmei?.entrepreneurialScore !== undefined) {
    return Math.round((sanmei.stabilityScore + sanmei.entrepreneurialScore) / 2);
  }

  const seimei = signals.seimei as { score?: number } | null;
  if (seimei?.score !== undefined) return Math.round(seimei.score);

  const compatibilityScore = signals.compatibilityScore as number | null;
  if (compatibilityScore !== undefined && compatibilityScore !== null) return Math.round(compatibilityScore);

  return 70;
}

interface NextActionTemplate {
  heading: string;
  actions: [string, string, string];
  closing: string;
}

/** GPT4(ネクストアクション文言設計)のテンプレートをスコア帯で引く。/prompts/content/ 配下でバージョン管理。 */
function pickNextActionTemplate(score: number): NextActionTemplate {
  const templates = loadNextActionTemplates();
  const key = score >= 80 ? "high" : score >= 50 ? "mid" : "low";
  return templates[key];
}

let cachedTemplates: Record<"high" | "mid" | "low", NextActionTemplate> | null = null;

function loadNextActionTemplates(): Record<"high" | "mid" | "low", NextActionTemplate> {
  if (cachedTemplates) return cachedTemplates;
  try {
    const filePath = path.join(process.cwd(), "prompts", "content", "next_action_templates.v2.0.json");
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    cachedTemplates = {
      high: data.byScoreRange.high,
      mid: data.byScoreRange.mid,
      low: data.byScoreRange.low,
    };
    return cachedTemplates;
  } catch {
    // フォールバック(ファイルが見つからない実行環境向け)
    const fallback: NextActionTemplate = {
      heading: "穏やかに過ごしたい一日",
      actions: ["気になっていた連絡を1つだけ送ってみる", "予定を1つ減らして休む時間を作る", "今日の感情を3行だけメモに残す"],
      closing: "大丈夫、あなたのペースで。",
    };
    return { high: fallback, mid: fallback, low: fallback };
  }
}
