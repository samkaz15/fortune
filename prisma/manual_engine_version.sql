-- ============================================================
-- 占術エンジンバージョン管理 (CEO1 D-0a / 2026-07-12)
--
-- 背景: 占術ロジック正式化(D-9: 日柱基準日の修正ほか)により、
--   同一入力でも新旧ロジックで結果が変わる。過去結果は再計算せず、
--   「どの世代のエンジンで生成されたか」を行ごとに記録する方針(監修シートD-0a)。
--   既存行は DEFAULT 1 (=暫定ロジック世代) のまま。新規生成はアプリ側で
--   FORTUNE_ENGINE_VERSION (現在2) を書き込む。
--
-- 書式: manual_decision_report.sql の原本どおり quoted camelCase。冪等。
-- ロールバック:
--   ALTER TABLE "daily_reports"   DROP COLUMN IF EXISTS "engineVersion";
--   ALTER TABLE "fortune_results" DROP COLUMN IF EXISTS "engineVersion";
-- ============================================================

ALTER TABLE "daily_reports"
  ADD COLUMN IF NOT EXISTS "engineVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "fortune_results"
  ADD COLUMN IF NOT EXISTS "engineVersion" INTEGER NOT NULL DEFAULT 1;

-- 適用後の検証クエリ:
--   SELECT column_name, column_default FROM information_schema.columns
--     WHERE table_name IN ('daily_reports','fortune_results')
--       AND column_name = 'engineVersion';
