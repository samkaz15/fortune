-- daily_reports: 期間タブのユニークキー衝突修正(2026-07-11 Phase1指示A・要件②原因B)
-- 背景: (userId, reportDate) だけをキーにしていたため、月曜は today と week が、
--       毎月1日は today と month が同じ reportDate になり同一行を共有してしまっていた。
-- 列名は manual_decision_report.sql の原本どおり quoted camelCase("userId"等)。
-- 適用順序厳守: 1) 列追加 → 2) 旧ユニーク制約DROP → 3) 新ユニークINDEX作成
-- ロールバック: 3のINDEXをDROPし、2の制約を UNIQUE ("userId","reportDate") で再作成すれば復元可能。
ALTER TABLE "daily_reports" ADD COLUMN IF NOT EXISTS "period" TEXT NOT NULL DEFAULT 'today';
ALTER TABLE "daily_reports" DROP CONSTRAINT IF EXISTS "daily_reports_userId_reportDate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "daily_reports_userId_reportDate_period_key" ON "daily_reports" ("userId", "reportDate", "period");
