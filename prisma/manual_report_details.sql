-- 今日の運勢の内容拡充(要件⑤ 2026-07-08)
-- 出来事×3/注意×3/おすすめ行動×3(各理由付き)+総評をJSONで保持する。
-- 既存行はNULLのまま有効(クライアントは無ければ非表示、翌日以降の生成分から埋まる)。
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS details JSONB;
