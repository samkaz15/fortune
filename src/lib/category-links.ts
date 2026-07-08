/**
 * カテゴリ→無料診断ページの対応(占い相談/LP廃止 2026-07-08)。
 * 旧 /consult?category=X の行き先を対応する無料診断ページへ差し替えるための一元マップ。
 * サーバー/クライアント両方から使うため、依存ゼロの純粋モジュールとして分離
 * (recommendation.tsはdb依存のserver専用のため、client componentからimportできない)。
 */
export const CATEGORY_PAGE: Record<string, string> = {
  SELF: "/self",
  COMPATIBILITY: "/love",
  BUSINESS: "/work",
};

export function categoryPage(category: string): string {
  return CATEGORY_PAGE[category] ?? "/self";
}
