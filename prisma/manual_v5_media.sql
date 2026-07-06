-- UI仕様v5(2026-07-06): 神社に画像・動画・SNSリンクのメディア列を追加
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS media JSONB;
