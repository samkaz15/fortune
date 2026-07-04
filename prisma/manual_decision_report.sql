-- 意思決定レポート (CEO_UPDATE 2026-07-03)
CREATE TABLE "daily_reports" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "reportDate" DATE NOT NULL,
  "score" INTEGER NOT NULL,
  "stars" INTEGER NOT NULL,
  "keywords" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "cautions" JSONB NOT NULL,
  "advice" TEXT NOT NULL,
  "todayAction" TEXT NOT NULL,
  "scoreBreakdown" JSONB NOT NULL,
  "generatedBy" TEXT NOT NULL DEFAULT 'llm',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "reportDate")
);

CREATE TABLE "knowledge_entries" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL UNIQUE,
  "category" "ConsultCategory" NOT NULL,
  "userConcern" TEXT NOT NULL,
  "divinationSummary" TEXT NOT NULL,
  "finalAdvice" TEXT NOT NULL,
  "nextAction" TEXT NOT NULL,
  "tags" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "knowledge_entries_userId_createdAt_idx" ON "knowledge_entries"("userId", "createdAt");
