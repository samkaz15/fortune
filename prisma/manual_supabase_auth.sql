-- ============================================================
-- Supabase Auth移行 (認証本実装 / 2026-07-12)
-- users.authId: Supabase Auth(auth.users.id)との紐付け列。
-- レガシーユーザー(旧Cookie認証時代)はNULLのままでよく、
-- 初回ログイン時にemail一致でバックフィルされる(src/lib/auth.ts参照)。
-- 冪等。ロールバック: DROP INDEX/COLUMN。
-- ============================================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_authId_key" ON "users" ("authId");
-- 検証: SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='authId';
