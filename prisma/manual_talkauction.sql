-- トークション(電話占いオークションMVP)
ALTER TABLE auction_tickets ADD COLUMN IF NOT EXISTS "winnerUserId" TEXT;
ALTER TABLE auction_tickets ADD COLUMN IF NOT EXISTS "profileText" TEXT;
ALTER TABLE auction_tickets ADD COLUMN IF NOT EXISTS topics JSONB;

CREATE TABLE IF NOT EXISTS auction_reviews (
  id TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auction_reviews_ticket_user_key UNIQUE ("ticketId", "userId")
);
CREATE INDEX IF NOT EXISTS auction_reviews_createdAt_idx ON auction_reviews("createdAt");

CREATE TABLE IF NOT EXISTS auction_reservations (
  id TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS auction_reservations_userId_idx ON auction_reservations("userId");
