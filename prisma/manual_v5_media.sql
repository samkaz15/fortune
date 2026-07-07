-- UI仕様v5(2026-07-06): 神社に画像・動画・SNSリンクのメディア列を追加
ALTER TABLE shrines ADD COLUMN IF NOT EXISTS media JSONB;
-- アバター画像(2026-07-07): ユーザー設定アイコン(data URL)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar TEXT;

-- 占いエンジン月柱・年柱ロジック導入(2026-07-07)に伴う既存キャッシュのリセット。
-- 修正前に生成されたdaily_reportsは古いロジックのスコアのままなので削除し、
-- 次回アクセス時に新ロジックで自動再生成させる(ユーザー影響: 次回開いた時に再計算されるだけ)。
DELETE FROM daily_reports;
