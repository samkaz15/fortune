-- ============================================================
-- Phase2追加分 (CL16〜CL22)
-- ============================================================

-- CL22: LINE連携 / CL20: 紹介制度
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN "referredByUserId" TEXT;
ALTER TABLE "users" ADD COLUMN "lineUserId" TEXT UNIQUE;

-- CL17: 通知高度化
ALTER TABLE "notification_settings" ADD COLUMN "pushSubscription" JSONB;

CREATE TABLE "notification_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "score" INTEGER,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notification_logs_userId_createdAt_idx" ON "notification_logs"("userId", "createdAt");
CREATE INDEX "notification_logs_type_createdAt_idx" ON "notification_logs"("type", "createdAt");

-- CL20: ポイント制度
CREATE TABLE "point_balances" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "point_transactions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "point_balances"("userId") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "point_transactions_userId_createdAt_idx" ON "point_transactions"("userId", "createdAt");

-- CL18: 神社レビュー
CREATE TABLE "shrines" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "prefecture" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "tags" JSONB NOT NULL,
  "generalInfo" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "shrine_reviews" (
  "id" TEXT PRIMARY KEY,
  "shrineId" TEXT NOT NULL REFERENCES "shrines"("id") ON DELETE CASCADE,
  "authorType" TEXT NOT NULL DEFAULT 'ceo',
  "authorUserId" TEXT REFERENCES "users"("id"),
  "visitedAt" TIMESTAMP(3),
  "blocks" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "shrine_reviews_shrineId_createdAt_idx" ON "shrine_reviews"("shrineId", "createdAt");
