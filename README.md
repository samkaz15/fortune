# 錦糸町の少年（Itomachi no Shonen） 

AIがあなたの生年月日・名前から今日の運気とネクストアクションを届ける占いサービス。
「大丈夫。必ずうまくいく。」

このリポジトリはWBS（統合3フェーズ版）の **Phase1: CL1〜CL14** を実装したものです。

## 技術スタック

- **フロントエンド**：Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **バックエンド**：Next.js API Routes（同一リポジトリ内、BFF構成）
- **DB**：PostgreSQL + Prisma ORM（Supabase Postgres を推奨）
- **キャッシュ／カウンター**：Redis（Upstash を推奨。サーバーレスと相性が良い）
- **決済**：Stripe（サブスク／単発クレジット／オークション入札）
- **AI**：Sakana AI（外部API。`src/lib/fortune-engine/sakana-ai-adapter.ts` 経由で呼び出す）

推奨理由：Next.js + Vercelデプロイと相性が良く、Supabase/Upstash/Stripeは全てサーバーレスの
従量課金で小規模スタートに向く。将来のスケール化(Phase3)でも、DWH連携・マルチリージョン化への
移行パスがふさがれない構成になっている。

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を埋める
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## 実装状況（WBS対応表）

| WBS | 内容 | 状態 |
|---|---|---|
| CL1 | IA改訂 | 旧要約はArchive(現行は`docs/BLUEPRINT.md`第2部) |
| CL2 | 画面遷移設計書改訂 | 旧要約はArchive(現行は`docs/BLUEPRINT.md`第2部) |
| CL3 | データレイヤー追加設計 | 旧要約はArchive。実装は `src/lib/redis.ts`（カウンター）／`prisma/schema.prisma`（クレジット・オークション） |
| CL4 | 要件定義 | 旧要約はArchive(現行仕様は`docs/design/00_ceo_decisions/`) |
| CL5 | 画面設計（ワイヤーフレーム相当） | 実画面として `src/app/**/page.tsx` に直接実装 |
| CL6 | API設計 | `src/app/api/**/route.ts` 一式 |
| CL7 | DB設計 | `prisma/schema.prisma` |
| CL8 | 占術統合エンジン実装 | `src/lib/fortune-engine/` 完了。**ただし姓名判断・算命学・四柱推命は暫定ロジック**（各ファイル冒頭のコメント参照）。CEO占術監修(CEO1)後に正式ロジックへ差し替え必須 |
| CL9 | 占いチャット機能実装 | `src/components/ChatWindow.tsx` + `/api/chat` |
| CL10 | 決済実装（サブスク/クレジット/オークション） | API実装済み。**Stripe Webhook(決済確定処理)は実装済み(2026-07-12監査: 署名検証・サブスク/オークション/クレジット・invoice.payment_failed対応。残: Stripeダッシュボードでのエンドポイント登録)**、下記「残タスク」参照 |
| CL11 | マイページ・共通画面実装 | `src/app/mypage/` |
| CL12 | 天気API連携 | `src/lib/weather.ts`（Open-Meteo想定） |
| CL13 | 結合テスト | 未着手（下記参照） |
| CEO3 | CEOレビュー | 人間の意思決定が必要なため、コード化していません |
| CL14 | Phase1リリース | 未着手（インフラ環境構築が必要） |

## 残タスク（次にやるべきこと）

1. ~~**キャラクター設定・プロンプトの正式反映**~~ ✅ 完了(2026-07-03)
   CEO_STRATにより「錦糸町の少年」本人(カエル/男の子/一人称「僕」)に確定。
   `prompts/chat/system_prompt.v2.0.md` に反映済み。
2. **占術ロジックの精度確定 → 大部分完了(2026-07-12)**
CEO1監修シートに基づき正式化済み: 日柱基準修正(D-9)・節入りテーブル1900-2100(D-6)・時柱(D-7)・
画数辞書+旧字体変換(D-2)・霊数(D-3)・大運(D-10)・算命学の命式ベース化=案B(D-11)。
検証: `npm test`(独立実装との突き合わせゴールデンテスト)。
残り: 監修者レビュー(docs/supervisor_review_pack_v1.md)・吉凶表データ提供待ち(D-4)。

**(旧記述・参考)**
   CEO1(2026-07-03)により「カテゴリ別にどの占術を使うか」は確定・実装済み(`docs/design/00_ceo_decisions/CEO1_divination_logic_assignment.md`参照)。
   ただし各占術自体の計算精度(`seimei.ts`の画数辞書・`shichu.ts`の暦計算・`sanmei.ts`の命式)は
   引き続き暫定ロジック。流派の指定など、次回CEO監修が必要。
3. **Stripe Webhookの実装**
   `/api/billing/webhook` が未実装。`checkout.session.completed` を受けて
   クレジット残高加算・サブスク有効化を行う処理が必要（`CreditTransaction`作成、`Subscription.status`更新）。
4. **Supabase Authへの移行**
   現状 `src/lib/auth.ts` / `/api/auth/*` は Cookie直書きの開発用最小実装。
   本番投入前に Supabase Auth（またはNextAuth等）へ置き換える。
5. **News/お知らせモデルの追加**
   `src/app/news/page.tsx` は現状ダミーデータ。`prisma/schema.prisma` に `News` モデルを追加する。
6. **CL13 結合テスト・CEO3レビュー・CL14リリース**
   ここはコードの問題ではなく、実際に動かしながらCEOが確認する工程です。

## ディレクトリ構成 

```
src/
  app/            画面(Level1〜4) + APIルート
  components/     共通UI(Header/BottomNav/ChatWindow/ScoreOrb等)
  lib/
    fortune-engine/  占術統合エンジン(CL8の中核)
    db.ts            Prismaクライアント
    redis.ts         カウンター・キャッシュ・分散ロック
    stripe.ts        決済クライアント
    weather.ts       天気連携(CL12)
    auth.ts          認証(暫定実装)
prisma/
  schema.prisma   DB設計(CL7)
docs/             設計書の要約(CL1・CL2・CL4・CL3)
```
