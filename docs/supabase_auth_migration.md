# Supabase Auth 移行 Runbook (2026-07-12)

旧Cookie直書き認証(`dev_user_id`)からSupabase Authへの移行手順。
コード側は両対応済み: **SUPABASE環境変数が未設定なら自動的に旧dev方式で動く**ため、
ローカル開発は今まで通り、本番だけ順を追って切り替えられる。

## 1. Supabaseプロジェクト側の設定

1. Supabaseダッシュボード → Authentication → Providers → **Email を有効化**
   (初期リリースはメール+パスワードのみ。Google/Apple追加はPhase2)
2. Authentication → Settings:
   - 「Confirm email」は初期リリースでは**OFF推奨**(登録直後にセッションが張られ、
     signup APIのフローが1回で完結する。ONにする場合はメール確認後ログインのUI導線が必要)
   - **Inactivity timeout を 12時間**に設定(要件④のアイドルタイムアウト。
     ※この設定はSupabaseの有料プラン機能。無料プランの間はJWT expiryを短めにして近似する
     か、要件④の厳密な充足はプラン加入後とする — CEO判断事項)
3. Project Settings → API から以下を控える

## 2. 環境変数(Vercel)

| 変数 | 用途 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | プロジェクトURL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 公開キー(クライアント/サーバー共用) |
| SUPABASE_SERVICE_ROLE_KEY | **サーバー専用・秘匿**。レガシーユーザーの遅延移行にのみ使用 |

## 3. DBマイグレーション

`prisma/manual_supabase_auth.sql` を本番DBへ適用(users.authId列+ユニークINDEX。冪等)。
**適用順序: SQL → 環境変数設定 → デプロイ**(逆順だと新コードがauthId列を参照して落ちる)。

## 4. レガシーユーザーの扱い(自動)

旧方式で登録済みのユーザー(authId=NULL, passwordHashあり)は:
1. 新ログインAPIでSupabase認証に失敗 → 旧ハッシュで検証
2. 一致すればAdmin APIでSupabase側にユーザー作成 → authId紐付け → passwordHashをNULL化
3. 以後は完全にSupabase管理

SERVICE_ROLE_KEY未設定の環境では手順2が行えないため `LEGACY_MIGRATION_REQUIRED`(409)を返す。
その場合のUI側はパスワード再設定導線を案内すること。

## 5. 切り替え後の動作確認チェックリスト

- [ ] 新規登録 → そのままログイン状態になり /mypage に入れる
- [ ] ログアウト → /mypage が /auth/login へリダイレクトされる
- [ ] ログイン(新規で作ったアカウント) → 成功
- [ ] レガシーアカウントでログイン → `migrated: true` が返り、以後もログイン可能
- [ ] ブラウザのCookieから`dev_user_id`を手で追加しても本番で認証されない(なりすまし不可の確認)
- [ ] /api/report/today が認証済みで200を返す(以前の「レポートが見れない」問題の根治確認)
- [ ] Stripe Webhook実装時: customer→userの突合はUser.id基準のままでOK(authIdはStripeに出さない)

## 6. 変更ファイル一覧

- `src/lib/supabase/server.ts`(新規): サーバークライアント+Admin
- `src/lib/auth.ts`: getCurrentUserId をSupabaseセッション検証へ(dev fallback付き)
- `src/app/api/auth/{signup,login,logout}/route.ts`: Supabase対応
- `src/middleware.ts`: セッションリフレッシュ(@supabase/ssr標準パターン)
- `prisma/schema.prisma` + `prisma/manual_supabase_auth.sql`: User.authId
- `.env.example`: SUPABASE_SERVICE_ROLE_KEY 追記
