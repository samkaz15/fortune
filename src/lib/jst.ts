/**
 * JST(UTC+9)基準の日付ユーティリティ(2026-07-11 Phase1指示A / 要件②)。
 *
 * 背景: サーバーはUTCで動作するため、素の `new Date()` から日付を切り出すと
 * 日本時間の0:00〜8:59の間は「前日」の日付になってしまう。
 * daily_reports のキー(reportDate)は必ずこのユーティリティ経由で算出すること。
 */

/** JST基準の「今日」を、UTC 0時のDateとして返す(daily_reportsのキー用の正規化形式) */
export function jstToday(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
}
