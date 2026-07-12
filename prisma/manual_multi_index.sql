-- ============================================================
-- マルチインデックス拡張 (2026-07-12)
-- user_profiles.mbti: 自己申告のMBTIタイプ(例: 'INTJ')。NULL可。
-- 冪等。ロールバック: ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "mbti";
-- ============================================================
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "mbti" TEXT;
