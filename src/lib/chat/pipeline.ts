/**
 * AIチャット記憶パイプライン (Step3 / 2026-07-12)
 *
 * 元仕様の5ステップフロー:
 *   1. 相談内容受付 → 2. 過去相談履歴の検索(RAG) → 3. 占術データとの掛け合わせ →
 *   4. パーソナリティ分析の更新 → 5. 回答生成
 *
 * 出力フォーマットはLayer0(prompts/consulting/system_prompt.v2.0.md)の4部構成
 * (結論/根拠1/根拠2/但し書き)。4軸データ参照・1/7進捗回収トリガーもLayer0準拠。
 * キャラクターの声はLayer1(system_prompt.v2.6.md)。
 */
import { prisma } from "@/lib/db";
import { callClaude } from "@/lib/llm/claude-client";
import { CHARACTER_PROMPT } from "@/lib/fortune-engine";
import { searchKnowledge, searchLifeEvents, getUserKarte, getUnresolvedNextActions, updateUserKarte, type RetrievedKnowledge, type RetrievedLifeEvent } from "@/lib/karte/repository";
import { calculateTaiun } from "@/lib/fortune-engine/taiun";
import { buildMultiIndexReading } from "@/lib/fortune-engine/multi-index";
import { searchOracleKnowledge, formatOracleForPrompt } from "@/lib/oracle/knowledge-base";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ConsultCategory } from "@/generated/prisma/enums";

function loadConsultingPolicy(): string {
  try {
    return readFileSync(path.join(process.cwd(), "prompts", "consulting", "system_prompt.v2.0.md"), "utf-8");
  } catch {
    return "";
  }
}

/** 約1/7の確率で進捗回収モードへ(要件: 動的発火トリガー) */
function shouldTriggerProgressCheck(): boolean {
  return Math.random() < 1 / 7;
}

export interface ChatTurnResult {
  reply: string;
  progressCheckTriggered: boolean;
  retrievedKnowledgeCount: number;
  /** Claude生成が成功したか。falseはフォールバック文言(Quota払い戻し対象=CEO_QUOTA_definition「返信が届いた回数」) */
  llmSucceeded: boolean;
}

/**
 * ユーザーの1メッセージを受け取り、5ステップフローで応答を生成する。
 * sessionIdは呼び出し元(APIルート)がFortuneSessionを作成/継続して渡す。
 */
export async function runChatTurn(params: {
  userId: string;
  sessionId: string;
  userMessage: string;
  category: ConsultCategory;
}): Promise<ChatTurnResult> {
  const { userId, sessionId, userMessage, category } = params;

  // ---- 1. 相談内容受付: 今回の発言を保存 ----
  await prisma.fortuneMessage.create({
    data: { sessionId, role: "user", content: userMessage },
  });

  // ---- 2. 過去相談履歴の検索(RAG・4軸データのうち①③④) ----
  const [knowledge, lifeEvents, karte, history, unresolvedActions] = await Promise.all([
    searchKnowledge(userId, userMessage),
    searchLifeEvents(userId, userMessage),
    getUserKarte(userId),
    prisma.fortuneMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 20, // 直近の会話文脈(4軸データの②時間軸・直近の流れ)
    }),
    getUnresolvedNextActions(userId),
  ]);

  // ---- 3. 占術データとの掛け合わせ ----
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  let divination: Record<string, unknown> = {};
  if (profile) {
    // マルチインデックス(2026-07-12): 10指標の「根拠の束」+大運。
    // convergence(指標間の一致)は断定の根拠に、矛盾は「バグの解剖」の材料に使われる(Layer0)
    const nameParts = profile.name.trim().split(/[\s　]+/);
    const multi = buildMultiIndexReading({
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      familyName: nameParts[0] ?? null,
      givenName: nameParts[1] ?? nameParts[0] ?? null,
    });
    const taiun = calculateTaiun(profile.birthDate, profile.birthTime, profile.gender);
    divination = {
      ...multi,
      currentTaiun: taiun?.pillars.find((p) => p.startAgeYears <= ageOf(profile.birthDate) && ageOf(profile.birthDate) < p.startAgeYears + 10) ?? null,
    };
  }

  // ---- 師匠知見ベース(Oracle KB): 発言に関連するCEO直伝ノウハウを想起 ----
  const oracleEntries = searchOracleKnowledge(userMessage);

  // ---- 動的発火トリガー(1/7): 未回収の行動提案があれば進捗回収モードへ ----
  const progressCheckTriggered = unresolvedActions.length > 0 && shouldTriggerProgressCheck();

  // ---- 4. パーソナリティ分析の更新(直近の会話から悩み傾向を推定し、カルテへ反映) ----
  // Phase1実装: カテゴリ頻度による簡易反映(LLM要約への差し替えは監修後・Phase2)
  const concernTrends = {
    ...((karte?.concernTrends as Record<string, number>) ?? {}),
  };
  concernTrends[category] = (concernTrends[category] ?? 0) + 1;
  await updateUserKarte(userId, { concernTrends }, "session_completed");

  // ---- 5. 回答生成 ----
  const systemPrompt = [
    loadConsultingPolicy(),
    "",
    CHARACTER_PROMPT,
    "",
    "# 4軸データ参照コンテキスト(Layer0 §3の実データ)",
    `過去の関連相談(similarity順・上位${knowledge.length}件): ${JSON.stringify(knowledge.map((k: RetrievedKnowledge) => ({ concern: k.userConcern, advice: k.finalAdvice, when: k.createdAt })))}`,
    `関連する人生イベント: ${JSON.stringify(lifeEvents.map((e: RetrievedLifeEvent) => ({ title: e.title, when: e.occurredAt })))}`,
    `現在の人生カルテ: ${karte ? JSON.stringify({ personality: karte.basicPersonality, trends: karte.concernTrends, insights: karte.aiInsights }) : "まだ蓄積なし(初回相談)"}`,
    `命式データ: ${JSON.stringify(divination)}`,
    formatOracleForPrompt(oracleEntries),
    progressCheckTriggered
      ? `# 進捗回収モード発火\n以下の未回収の行動提案について、実践できたか進捗確認・逆質問を最優先で行うこと: ${JSON.stringify(unresolvedActions.map((a: { nextAction: string }) => a.nextAction))}`
      : "",
  ].join("\n");

  const historyForLlm = history.slice(0, -1).map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const reply = await callClaude({
    systemPrompt,
    userInput: userMessage,
    history: historyForLlm,
    maxTokens: 800,
  });

  const finalReply = reply ?? fallbackReply(category);

  await prisma.fortuneMessage.create({
    data: { sessionId, role: "assistant", content: finalReply },
  });

  return {
    reply: finalReply,
    progressCheckTriggered,
    retrievedKnowledgeCount: knowledge.length,
    llmSucceeded: reply !== null,
  };
}

function ageOf(birthDate: Date): number {
  return Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/** Claude API不在・失敗時のフォールバック(空白応答を出さない) */
function fallbackReply(category: ConsultCategory): string {
  return "すみません、、今ちょっと混み合ってて考えがまとまらないです泣 少し時間おいてもう一度送ってもらえますか?";
}
