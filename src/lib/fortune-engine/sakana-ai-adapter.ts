/**
 * Sakana AI 連携アダプタ
 *
 * 占術ロジック(seimei/shichu/sanmei/horoscope)が出した構造化データを、
 * 「糸町の少年」というキャラクターの口調で自然文に変換してもらうための層。
 * ドメインロジック(index.ts)からは常にこの関数だけを呼び、
 * 実際のAPI仕様変更の影響をここに閉じ込める(Data Access Layer的な考え方)。
 *
 * SAKANA_AI_API_KEY が未設定の開発環境では、モック応答にフォールバックする
 * (フロント/チャットの動作確認をAPIキーなしでも行えるようにするため)。
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export interface SakanaAIRequest {
  category: string;
  characterPrompt: string; // GPT2で設計するキャラクター口調プロンプト
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

export async function callSakanaAI(req: SakanaAIRequest): Promise<SakanaAIResponse> {
  if (!SAKANA_AI_API_KEY || !SAKANA_AI_ENDPOINT) {
    return mockSakanaAIResponse(req);
  }

  const res = await fetch(SAKANA_AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SAKANA_AI_API_KEY}`,
    },
    body: JSON.stringify({
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

/** APIキー未設定時の開発用モック。占術ロジックの結果とネクストアクションテンプレート(GPT4)を反映する。 */
function mockSakanaAIResponse(req: SakanaAIRequest): SakanaAIResponse {
  const wave = Math.round((req.signals.shichu as { wave?: number } | undefined)?.wave ?? 60);
  const template = pickNextActionTemplate(wave);

  return {
    message:
      "そっか…その気持ち、ちゃんと受け止めましたよ。" +
      `今のあなたは${template.heading}。無理をしなくても大丈夫。` +
      `まずは「${template.actions[0]}」ところから始めてみませんか。`,
    summary: `今日の総合運は${wave}点。${template.heading}。`,
    nextActions: [template.actions[0], template.actions[1], template.actions[2]],
    overallScore: wave,
  };
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
    const filePath = path.join(process.cwd(), "prompts", "content", "next_action_templates.v1.0.json");
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
