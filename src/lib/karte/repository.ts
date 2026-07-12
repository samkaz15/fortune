/**
 * 人生カルテ・リポジトリ層 (Step3: AIチャット記憶機能 / 2026-07-12)
 *
 * 検索方式: pg_trgm全文検索(CEO決定・2026-07-12「初期段階ではEmbeddingではなくpg_trgmで実装」)。
 * 将来pgvectorへ拡張する場合はこのファイルの検索関数(searchKnowledge/searchLifeEvents)の
 * 中身だけを差し替えれば呼び出し元(chat pipeline)は変更不要(manual_life_karte.sqlのコメント参照)。
 *
 * 全クエリは必ずuserIdで絞り込んだ上でsimilarity()を使う(他ユーザーの記憶を漏らさないため、
 * かつuserId絞り込みが先に効くことでtrgmインデックスの実用速度が出る)。
 */
import { prisma } from "@/lib/db";
import type { ConsultCategory } from "@/generated/prisma/enums";

export interface RetrievedKnowledge {
  id: string;
  category: ConsultCategory;
  userConcern: string;
  finalAdvice: string;
  nextAction: string;
  tags: string[];
  importance: number;
  createdAt: Date;
  similarity: number;
}

export interface RetrievedLifeEvent {
  id: string;
  title: string;
  description: string | null;
  category: ConsultCategory;
  occurredAt: Date | null;
  emotion: string | null;
  importance: number;
  similarity: number;
}

const TRGM_THRESHOLD = 0.15; // pg_trgmの類似度しきい値(0-1)。低いほど広く拾う。要チューニング

/**
 * 今回の相談文に近い過去のKnowledgeEntryをpg_trgmで検索する(RAGの中核)。
 * userConcern・finalAdviceの両方に対して類似度を取り、高い方を採用する。
 * 該当なしでも空配列を返す(呼び出し元は「初回相談」として扱える)。
 */
export async function searchKnowledge(userId: string, queryText: string, limit = 5): Promise<RetrievedKnowledge[]> {
  if (!queryText.trim()) return [];
  const rows = await prisma.$queryRaw<
    Array<RetrievedKnowledge & { tags: unknown }>
  >`
    SELECT id, category, "userConcern", "finalAdvice", "nextAction", tags, importance, "createdAt",
           GREATEST(similarity("userConcern", ${queryText}), similarity("finalAdvice", ${queryText})) AS similarity
    FROM knowledge_entries
    WHERE "userId" = ${userId}
      AND (similarity("userConcern", ${queryText}) > ${TRGM_THRESHOLD}
           OR similarity("finalAdvice", ${queryText}) > ${TRGM_THRESHOLD})
    ORDER BY similarity DESC, importance DESC, "createdAt" DESC
    LIMIT ${limit}
  `;
  // 参照時刻を更新(記憶の鮮度管理。失敗しても検索結果は返す)
  if (rows.length > 0) {
    void prisma.knowledgeEntry
      .updateMany({ where: { id: { in: rows.map((r: { id: string }) => r.id) } }, data: { lastReferencedAt: new Date() } })
      .catch(() => {});
  }
  return rows.map((r: RetrievedKnowledge & { tags: unknown }) => ({ ...r, tags: (r.tags as string[]) ?? [] }));
}

/** 相談文に近い過去のLifeEventを検索する(「人生の変遷」の想起) */
export async function searchLifeEvents(userId: string, queryText: string, limit = 3): Promise<RetrievedLifeEvent[]> {
  if (!queryText.trim()) return [];
  return prisma.$queryRaw<RetrievedLifeEvent[]>`
    SELECT id, title, description, category, "occurredAt", emotion, importance,
           GREATEST(similarity(title, ${queryText}), similarity(COALESCE(description, ''), ${queryText})) AS similarity
    FROM life_events
    WHERE "userId" = ${userId}
      AND (similarity(title, ${queryText}) > ${TRGM_THRESHOLD}
           OR similarity(COALESCE(description, ''), ${queryText}) > ${TRGM_THRESHOLD})
    ORDER BY similarity DESC, importance DESC
    LIMIT ${limit}
  `;
}

/** 現在の人生カルテを取得(無ければnull。初回相談者はカルテがまだ無い) */
export async function getUserKarte(userId: string) {
  return prisma.userKarte.findUnique({ where: { userId } });
}

/**
 * カルテを更新する。更新前の状態をKarteSnapshotへ退避してから上書きする
 * (Step1設計原則: 過去の理解を失わない)。
 */
export async function updateUserKarte(
  userId: string,
  patch: {
    basicPersonality?: object;
    concernTrends?: object;
    lifeCycle?: object;
    values?: object;
    aiInsights?: string;
  },
  trigger: "session_completed" | "daily_batch" | "manual" = "session_completed"
): Promise<void> {
  await prisma.$transaction(async (tx: typeof prisma) => {
    const current = await tx.userKarte.findUnique({ where: { userId } });
    if (current) {
      await tx.karteSnapshot.create({
        data: {
          userId,
          version: current.version,
          data: current as unknown as object,
          trigger,
        },
      });
    }
    await tx.userKarte.upsert({
      where: { userId },
      create: { userId, ...patch, version: 1 },
      update: { ...patch, version: { increment: 1 } },
    });
  });
}

/** 相談から抽出した人生イベントを記録する */
export async function recordLifeEvent(params: {
  userId: string;
  sessionId?: string;
  category: ConsultCategory;
  title: string;
  description?: string;
  occurredAt?: Date | null;
  emotion?: string | null;
  importance?: number;
}): Promise<void> {
  await prisma.lifeEvent.create({
    data: {
      userId: params.userId,
      sessionId: params.sessionId,
      category: params.category,
      title: params.title,
      description: params.description,
      occurredAt: params.occurredAt ?? null,
      emotion: params.emotion ?? null,
      importance: params.importance ?? 3,
    },
  });
}

/** 直近のKnowledgeEntryから未回収の行動提案(nextAction)を取得(進捗回収モード用) */
export async function getUnresolvedNextActions(userId: string, limit = 3) {
  return prisma.knowledgeEntry.findMany({
    where: { userId, nextAction: { not: "" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, nextAction: true, createdAt: true, category: true },
  });
}
