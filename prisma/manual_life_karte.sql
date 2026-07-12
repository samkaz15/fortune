-- ============================================================
-- 人生カルテ (AI人生コンパス転換 Step1 / 2026-07-12)
--
-- 目的: 「占い結果の提供」から「人生の変遷の蓄積」へのDB転換。
--   1) user_kartes      … AIの現在の理解(User 1:1)
--   2) karte_snapshots  … カルテの変遷履歴(追記専用)
--   3) life_events      … 会話から抽出した人生イベント(時系列)
--   4) knowledge_entries … RAG想起用の重み付け列を追加
--
-- 検索方式: 初期は pg_trgm による全文検索(GINインデックス)。
--   将来 pgvector へ移行する場合は、このファイルは変更せず
--   manual_karte_vector.sql を新設して embedding 列+HNSWインデックスを追加する
--   (検索実装は src/lib/karte/repository 側の差し替えのみで対応する方針)。
--
-- 書式: manual_decision_report.sql の原本どおり quoted camelCase("userId"等)。
-- 冪等性: 全文 IF NOT EXISTS / IF EXISTS。再実行しても安全。
-- 適用順序: 1) 拡張 → 2) テーブル → 3) 通常INDEX → 4) GIN(trgm)INDEX → 5) 列追加
-- ロールバック: 末尾のコメント参照。
-- ============================================================

-- 1) 拡張(Supabase Postgresは pg_trgm 同梱。権限エラー時はダッシュボードのExtensionsから有効化)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) テーブル

-- 人生カルテ本体(User 1:1)
CREATE TABLE IF NOT EXISTS "user_kartes" (
  "userId"           TEXT PRIMARY KEY,
  "basicPersonality" JSONB,
  "concernTrends"    JSONB,
  "lifeCycle"        JSONB,
  "values"           JSONB,
  "aiInsights"       TEXT,
  "version"          INTEGER NOT NULL DEFAULT 1,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- カルテ変遷履歴(追記専用。アプリからUPDATE/DELETE禁止 = audit_logsと同運用)
CREATE TABLE IF NOT EXISTS "karte_snapshots" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "version"   INTEGER NOT NULL,
  "data"      JSONB NOT NULL,
  "trigger"   TEXT NOT NULL, -- session_completed | daily_batch | manual
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 人生イベント(人生の変遷)
CREATE TABLE IF NOT EXISTS "life_events" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "sessionId"   TEXT, -- 抽出元セッション(緩結合・FKなし=既存manual SQLの規約に準拠)
  "occurredAt"  TIMESTAMP(3), -- 出来事の時期(不明ならNULL=「時期不明」)
  "category"    "ConsultCategory" NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "emotion"     TEXT, -- positive | negative | mixed | neutral
  "importance"  INTEGER NOT NULL DEFAULT 3, -- 1-5
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) 通常INDEX・ユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS "karte_snapshots_userId_version_key"
  ON "karte_snapshots" ("userId", "version");
CREATE INDEX IF NOT EXISTS "life_events_userId_occurredAt_idx"
  ON "life_events" ("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "life_events_userId_createdAt_idx"
  ON "life_events" ("userId", "createdAt");

-- 4) 全文検索用 GIN(pg_trgm) インデックス
--    検索クエリ側は必ず userId で絞り込んだうえで similarity()/ILIKE '%..%' を使うこと
--    (trgmインデックスは ILIKE 中間一致にも効く。userId絞り込みが先に効くため実用速度が出る)。
CREATE INDEX IF NOT EXISTS "life_events_title_trgm_idx"
  ON "life_events" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "life_events_description_trgm_idx"
  ON "life_events" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "knowledge_entries_userConcern_trgm_idx"
  ON "knowledge_entries" USING gin ("userConcern" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "knowledge_entries_finalAdvice_trgm_idx"
  ON "knowledge_entries" USING gin ("finalAdvice" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_kartes_aiInsights_trgm_idx"
  ON "user_kartes" USING gin ("aiInsights" gin_trgm_ops);

-- 5) knowledge_entries へ RAG想起用の重み付け列を追加
ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "emotionalTone" TEXT;
ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "importance" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "lastReferencedAt" TIMESTAMP(3);

-- ============================================================
-- ロールバック手順(必要時のみ手動実行):
--   DROP INDEX IF EXISTS "user_kartes_aiInsights_trgm_idx",
--     "knowledge_entries_finalAdvice_trgm_idx", "knowledge_entries_userConcern_trgm_idx",
--     "life_events_description_trgm_idx", "life_events_title_trgm_idx";
--   ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "lastReferencedAt",
--     DROP COLUMN IF EXISTS "importance", DROP COLUMN IF EXISTS "emotionalTone";
--   DROP TABLE IF EXISTS "life_events", "karte_snapshots", "user_kartes";
--   ※ pg_trgm 拡張は他機能で使う可能性があるため DROP しない。
-- ============================================================

-- 適用後の検証クエリ:
--   SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
--   SELECT tablename FROM pg_tables WHERE tablename IN ('user_kartes','karte_snapshots','life_events');
--   SELECT indexname FROM pg_indexes WHERE indexname LIKE '%trgm%';
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='knowledge_entries' AND column_name IN ('emotionalTone','importance','lastReferencedAt');
