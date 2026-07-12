# CL13 結合テスト報告書 (2026-07-12)

実施環境: ローカルPostgreSQL 16(C.UTF-8)に本番と同一のmanual SQL全10本を本番想定順で適用した複製DB。
実行方法: `INTEGRATION_DATABASE_URL=... npm run test:integration`(再現可能・CI組込み可)

## 結果サマリ

| 区分 | 結果 |
|---|---|
| SQLマイグレーション結合(10本連続適用) | **10/10 成功** |
| DB結合テスト(スキーマ/インデックス/RAG/制約) | **9/9 成功** |
| 占術エンジン回帰(ゴールデンテスト) | **15/15 成功**(todo 4=監修者ケース待ち) |

## 検証項目

- **A. スキーマ整合性**: schema.prismaの全`@@map`テーブル(28+)が実DBに存在
- **B. 拡張・インデックス**: pg_trgm有効化、trgm GINインデックス5本、authId/engineVersion/period列(後付けSQL3本の適用効果)
- **C. RAG結合**: チャット記憶検索(similarity+ILIKEハイブリッド)が実データで関連記憶を返し、**他ユーザーの記憶が漏れない**こと
- **D. 制約の実効性**: daily_reports(userId,reportDate,period)ユニーク=期間タブ衝突修正の回帰確認、karte_snapshots(userId,version)ユニーク、engineVersion DEFAULT 1

## 🔴 結合テストで発見・修正した不具合(2件)

### 1. 日本語RAGがロケール依存で全滅するリスク(重大・修正済み)
pg_trgmは**DBの`lc_ctype`がUTF-8系でない場合、日本語のトライグラムを一切生成しない**
(`show_trgm('転職相談')`が空配列 → similarityが常に0 → 記憶検索が無音で0件)。
**修正**: 検索をハイブリッド化(`similarity` + ロケール非依存の`ILIKE`キーワードOR条件。
キーワードは助詞分割の純粋関数`karte/keywords.ts`で抽出)。しきい値も日本語実測で0.15→0.05へ調整。
**本番確認必須**: Supabase SQL Editorで以下を実行し、結果が空でないこと。
```sql
SELECT show_trgm('転職相談');
```

### 2. manual_init.sqlは冪等でない(仕様として明確化)
初期化SQLのみ`IF NOT EXISTS`なし(再実行するとエラー)。適用済み本番への再実行は禁止。
後付けSQL(report_period以降の6本)はすべて冪等であることを再適用で確認済み。

## この環境で実施できず、ステージングで必要な手動結合テスト

Prismaエンジンバイナリの取得制限によりNext.jsアプリ本体の起動結合は不可のため、以下はデプロイ環境での確認が必要:

- [ ] 新規登録→ログイン状態→/mypage(Supabase Auth結合)
- [ ] レガシーアカウントのログイン→`migrated: true`
- [ ] 偽装`dev_user_id` Cookieで認証されないこと
- [ ] /report表示→花びら演出→チャットで相談→4部構成+寒川トーンの返答(要ANTHROPIC_API_KEY)
- [ ] 2通目以降で過去相談への言及(RAG本番結合)
- [ ] 無料会員2通目→402+アップグレード導線 / JST深夜0時台のQuota消費が当日枠であること
- [ ] Stripeテストモード: checkout完了→subscriptions.status=active、カード失敗→paused(要Webhook登録)
- [ ] `SELECT show_trgm('転職相談');` が空でないこと(上記1)
