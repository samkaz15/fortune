import { prisma } from "@/lib/db";
import type { ConsultCategory } from "@/generated/prisma/enums";

/**
 * CL19: パーソナライズ・推薦ロジック(Phase2版)
 *
 * 独自機能の要件「似た傾向のユーザーでは、どのような行動が良い結果につながりやすいか」の
 * 最初の実装。データレイヤー設計書⑥の匿名化方針に厳密に従う:
 *
 * - 分析対象は「行動の集計」のみ。個人単位のデータ・PIIは一切参照しない
 * - k-匿名性: 集計セグメントの母数が K_ANONYMITY_MIN 未満なら、その推薦は出さず
 *   フォールバック(固定の遷移ルール)を使う
 * - ここで作る集計は分析用DWHに渡せる形(カテゴリ×カテゴリの遷移件数)と同じ構造にしており、
 *   Phase3(CL27)でSakana AI連携の推薦基盤に置き換える時もインターフェースは変えない
 *
 * ロジック: 「カテゴリXを診断した人が、次にどのカテゴリを診断したか」の遷移行列を
 * 全ユーザーの匿名集計から作り、最頻の遷移先を「次のおすすめ」として返す。
 */

const K_ANONYMITY_MIN = 20;

const CATEGORY_LABEL: Record<ConsultCategory, string> = {
  RELATIONSHIP: "人間関係",
  SELF: "自分のこと",
  BUSINESS: "ビジネス",
  COMPATIBILITY: "相性",
  TODAY: "今日の占い",
};

/** k-匿名性を満たすデータが無いときのフォールバック遷移(編集部ルール) */
const FALLBACK_NEXT: Record<ConsultCategory, ConsultCategory> = {
  TODAY: "SELF", // 今日の運気を見た人 → 自己分析へ
  SELF: "BUSINESS", // 自分を知った人 → 仕事の適性へ
  BUSINESS: "RELATIONSHIP", // 仕事の悩み → 職場の人間関係へ
  RELATIONSHIP: "COMPATIBILITY", // 人間関係 → 特定の相手との相性へ
  COMPATIBILITY: "TODAY", // 相性を見た人 → 明日また今日の運気へ
};

export interface NextCategoryRecommendation {
  category: ConsultCategory;
  label: string;
  /** データに基づく推薦か、フォールバックか(計測用に返す) */
  source: "collaborative" | "fallback";
}

export async function recommendNextCategory(
  currentCategory: ConsultCategory
): Promise<NextCategoryRecommendation> {
  // 「currentCategoryのセッションを完了したユーザーが、その次に完了したセッションのカテゴリ」を集計する。
  // ユーザーIDはGROUP化のキーとしてのみ使い、結果には個人情報を一切含めない(匿名集計)。
  const transitions = await prisma.$queryRaw<Array<{ next_category: ConsultCategory; cnt: bigint }>>`
    WITH ordered AS (
      SELECT
        "userId",
        category,
        LEAD(category) OVER (PARTITION BY "userId" ORDER BY "createdAt") AS next_category
      FROM fortune_sessions
      WHERE status = 'completed'
    )
    SELECT next_category, COUNT(*) AS cnt
    FROM ordered
    WHERE category = ${currentCategory}::"ConsultCategory"
      AND next_category IS NOT NULL
      AND next_category != ${currentCategory}::"ConsultCategory"
    GROUP BY next_category
    ORDER BY cnt DESC
    LIMIT 1;
  `;

  const top = transitions[0];
  if (top && Number(top.cnt) >= K_ANONYMITY_MIN) {
    return {
      category: top.next_category,
      label: CATEGORY_LABEL[top.next_category],
      source: "collaborative",
    };
  }

  const fallback = FALLBACK_NEXT[currentCategory];
  return { category: fallback, label: CATEGORY_LABEL[fallback], source: "fallback" };
}
