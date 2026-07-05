# Phase3 スケール化アーキテクチャ設計 (CL29/CL30/CL32)

**根拠**: docs/research/GM10_scale_growth_report.md(2026-07-05納品)

## CL29: キャッシュ/CDN強化

| 層 | 実装 | 状態 |
|---|---|---|
| ブラウザ/CDN | next.config.mjs headers(静的アセット長期キャッシュ) | ✅ 実装済み |
| アプリ | Redisキャッシュ(ランキング15分/レポート1日1回生成) | ✅ 実装済み(Phase2) |
| LLM | 意思決定レポートの1日1回生成=推論キャッシュ。チャットはRAG(KnowledgeEntry)で文脈圧縮 | ✅ 実装済み |
| 負荷試験 | scripts/load_test.sh(並列curl)。本番はk6/Locustへ移行 | ✅ スクリプト整備 |

トークン管理: analytics_events.props.tokens に使用量を記録し、dwh_daily_summaryで日次可視化(GM10「トークン数で管理」)。

## CL30: マルチリージョン・DB水平分割

- **今すぐやる(実装済み)**: 読み書き分離の接続層 `src/lib/db-replica.ts`
  (DATABASE_URL_REPLICA設定でリードレプリカへ振替。未設定ならプライマリ)
- **MAU10万〜**: Supabase/RDSのリードレプリカ追加。集計系(/api/admin/analytics, ランキング)をprismaReadへ切替
- **MAU100万〜(設計のみ)**:
  - ホット/コールド分離: 90日非アクティブユーザーのKnowledgeEntry/AnalyticsEventをアーカイブテーブルへ移動(GM10準拠)
  - 水平分割: userIdハッシュでN分割。シャードキーは常にuserId(全テーブルがuserId起点のため分割容易)
  - リージョン: 東京プライマリ+読み取りエッジ(Vercel Edge+リージョナルレプリカ)

## CL32: 監視/SRE

- ヘルスチェック: `/api/health`(DB/Redis疎通+レイテンシ)→外形監視(UptimeRobot等5分間隔)
- エラー監視: Vercelログ+Sentry導入(本番デプロイ時)。クォータ払い戻し失敗等はAuditLogに記録済み
- SLO: 決済反映1秒以内(conversion_spec.md §4)/チャット応答p95 5秒以内/可用性99.9%
- 回帰テスト: scripts/integration_test.sh(70項目)をデプロイ前必須ゲートとする。重要フローのPlaywright化はGM10推奨に従い本番後導入
