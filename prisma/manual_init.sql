-- ============================================================
-- 錦糸町の少年 初期スキーマ (prisma/schema.prisma から手動生成)
-- 生成理由: サンドボックス環境では prisma migrate に必要な
-- schema-engine バイナリが取得できないため。
-- 本番環境では `npx prisma migrate dev` を正とすること。
-- ============================================================

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT,
  "authProvider" TEXT NOT NULL DEFAULT 'email',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);

CREATE TABLE "user_profiles" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3) NOT NULL,
  "birthTime" TEXT,
  "gender" TEXT,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TYPE "ConsultCategory" AS ENUM ('RELATIONSHIP', 'SELF', 'BUSINESS', 'COMPATIBILITY', 'TODAY');

CREATE TABLE "fortune_sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" "ConsultCategory" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "fortune_sessions_userId_createdAt_idx" ON "fortune_sessions"("userId", "createdAt");

CREATE TABLE "fortune_messages" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES "fortune_sessions"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "fortune_messages_sessionId_createdAt_idx" ON "fortune_messages"("sessionId", "createdAt");

CREATE TABLE "fortune_results" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL UNIQUE REFERENCES "fortune_sessions"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "summary" TEXT NOT NULL,
  "bodyText" TEXT,
  "bodyUrl" TEXT,
  "nextActions" JSONB NOT NULL,
  "scoreOverall" INTEGER,
  "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
  "seimeiScore" JSONB,
  "sanmeiSummary" JSONB,
  "shichuSummary" JSONB,
  "horoscope" JSONB,
  "weatherContext" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "fortune_results_userId_createdAt_idx" ON "fortune_results"("userId", "createdAt");

CREATE TABLE "daily_usages" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "usageDate" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("userId", "usageDate")
);

CREATE TABLE "subscriptions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "planPriceJpy" INTEGER NOT NULL DEFAULT 500,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "currentPeriodEnd" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "credit_balances" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "credit_transactions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "credit_balances"("userId") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "priceJpy" INTEGER,
  "stripePaymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "credit_transactions_userId_createdAt_idx" ON "credit_transactions"("userId", "createdAt");

CREATE TABLE "auction_tickets" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "startPriceJpy" INTEGER NOT NULL DEFAULT 1000,
  "currentPriceJpy" INTEGER NOT NULL DEFAULT 1000,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "opensAt" TIMESTAMP(3) NOT NULL,
  "closesAt" TIMESTAMP(3) NOT NULL,
  "winningBidId" TEXT UNIQUE,
  "version" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "auction_tickets_status_closesAt_idx" ON "auction_tickets"("status", "closesAt");

CREATE TABLE "bids" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL REFERENCES "auction_tickets"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amountJpy" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "stripeHoldId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "bids_ticketId_amountJpy_idx" ON "bids"("ticketId", "amountJpy");

CREATE TABLE "notification_settings" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "scoreThreshold" INTEGER NOT NULL DEFAULT 95,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
