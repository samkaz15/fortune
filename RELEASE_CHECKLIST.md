# リリースチェックリスト (CL33: スケール対応版 v1.0.0)

## デプロイ前(必須ゲート)
- [ ] `npx tsc --noEmit` エラーゼロ
- [ ] `npm run build` 成功
- [ ] `bash scripts/integration_test.sh` 全項目パス
- [ ] `bash scripts/load_test.sh` で /api/health ほか全200

## インフラ(ユーザー作業)
- [ ] Vercel: 環境変数(DATABASE_URL / UPSTASH_* / STRIPE_* / SAKANA_AI_* / ADMIN_SECRET / CRON_SECRET)
- [ ] Supabase: prisma/manual_init.sql → manual_phase2.sql → manual_decision_report.sql → manual_phase3.sql を順に適用
- [ ] Stripe: 本番Price(月980円)+初月500円Coupon作成、Webhookエンドポイント登録(署名シークレット設定)
- [ ] Upstash: Redis作成(未設定でもインメモリで動作するが本番は必須)
- [ ] 外形監視: /api/health を5分間隔で監視登録

## リリース直後
- [ ] /admin/analytics でイベントが流れているか確認(chat_message / report_generated)
- [ ] テスト決済1件 → 反映1秒以内(SLO)をAuditLog/画面で確認
- [ ] crisis検知の動作確認(検知ワード→固定文面・消費なし)

## ロールバック
- Vercelの直前デプロイへ即時Revert(DBはadditiveマイグレーションのみのため後方互換)
