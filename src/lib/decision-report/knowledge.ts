/**
 * 意思決定レポート ③RAG検索層 + 知識ベース生成
 *
 * 仕様(CEO_UPDATE「会話ログの活用」):
 * 生の会話ログをそのまま使わず、構造化サマリ(KnowledgeEntry)へ変換して保存し、
 * レポート生成時に検索・参照する。
 *
 * Phase2実装: タグ頻度集計方式(決定論的)。ベクトル検索(pgvector)はPhase3
 * (production_design.md §3参照。KnowledgeEntryにembedding列を後付けできる構造)。
 */
import { prisma } from "@/lib/db";
import type { ConsultCategory } from "@/generated/prisma/enums";

export interface UserThemeFeatures {
  /** ②-a に表示する代表テーマ(過去の相談から抽出)。履歴が無い場合はnull */
  theme: string | null;
  /** LLMに渡す関連タグ(頻度順) */
  recentTags: string[];
  /** 直近の相談内容の要点(パーソナライズ用) */
  recentConcerns: string[];
}

const CATEGORY_TAG: Record<ConsultCategory, string> = {
  RELATIONSHIP: "人間関係",
  SELF: "自分らしさ",
  BUSINESS: "仕事",
  COMPATIBILITY: "相性",
  TODAY: "日々の流れ",
};

/**
 * セッション完了時に呼ぶ。会話ログを構造化してKnowledgeEntryに保存する。
 * Phase2はルールベース抽出(LLM節約)。Phase3でLLM要約に置き換える(インターフェースは不変)。
 */
export async function createKnowledgeEntry(params: {
  userId: string;
  sessionId: string;
  category: ConsultCategory;
  firstUserMessage: string;
  fortuneKeyword: string; // 占術キーワード(shichuのadvice等から)
  advice: string;
  nextAction: string;
}): Promise<void> {
  const { userId, sessionId, category, firstUserMessage, fortuneKeyword, advice, nextAction } = params;

  const tags = [CATEGORY_TAG[category], fortuneKeyword].filter(Boolean);

  await prisma.knowledgeEntry.upsert({
    where: { sessionId },
    create: {
      userId,
      sessionId,
      category,
      userConcern: firstUserMessage.slice(0, 120),
      divinationSummary: fortuneKeyword,
      finalAdvice: advice.slice(0, 200),
      nextAction: nextAction.slice(0, 100),
      tags,
    },
    update: {}, // 既存なら何もしない(セッション1回=1エントリ)
  });
}

/** 直近30日の知識ベースから、ユーザーが今向き合っているテーマを抽出する */
export async function extractUserTheme(userId: string): Promise<UserThemeFeatures> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const entries = await prisma.knowledgeEntry.findMany({
    where: { userId, createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (entries.length === 0) {
    return { theme: null, recentTags: [], recentConcerns: [] };
  }

  // タグ頻度集計
  const tagCount = new Map<string, number>();
  for (const e of entries) {
    for (const tag of (e.tags as string[]) ?? []) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }
  const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1]);
  const recentTags = sorted.slice(0, 5).map(([tag]) => tag);

  return {
    theme: recentTags[0] ?? null,
    recentTags,
    recentConcerns: entries.slice(0, 3).map((e) => e.userConcern),
  };
}
