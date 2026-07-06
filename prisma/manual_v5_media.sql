-- UI仕様v5(2026-07-06): 神社に画像・動画・SNSリンクのメディア列を追加
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS media JSONB;
-- アバター画像(2026-07-07): ユーザー設定アイコン(data URL)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
