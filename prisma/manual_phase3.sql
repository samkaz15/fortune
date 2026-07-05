-- Phase3: スケール化基盤 (CL25/CL26/CL31)
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  name TEXT NOT NULL,
  props JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS analytics_events_name_createdAt_idx ON analytics_events(name, "createdAt");
CREATE INDEX IF NOT EXISTS analytics_events_userId_createdAt_idx ON analytics_events("userId", "createdAt");

CREATE TABLE IF NOT EXISTS user_features (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  version INTEGER NOT NULL,
  "consultCount30d" INTEGER NOT NULL,
  "favoriteCategory" TEXT,
  "avgScore30d" DOUBLE PRECISION,
  "activeDays30d" INTEGER NOT NULL,
  "isSubscriber" BOOLEAN NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_features_userId_version_key UNIQUE ("userId", version)
);
CREATE INDEX IF NOT EXISTS user_features_userId_computedAt_idx ON user_features("userId", "computedAt");

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "experimentKey" TEXT NOT NULL,
  variant TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT experiment_assignments_userId_key_key UNIQUE ("userId", "experimentKey")
);
CREATE INDEX IF NOT EXISTS experiment_assignments_key_variant_idx ON experiment_assignments("experimentKey", variant);

-- CL25: DWH日次集計ビュー(BIから参照)
CREATE OR REPLACE VIEW dwh_daily_summary AS
SELECT
  date_trunc('day', "createdAt")::date AS day,
  name,
  count(*) AS events,
  count(DISTINCT "userId") AS unique_users,
  COALESCE(sum((props->>'tokens')::int), 0) AS total_tokens
FROM analytics_events
GROUP BY 1, 2;
