# 糸町の少年 — Project Structure & Design System

作成日: 2026-07-07 / 対象コミット: f18819d
**本ドキュメントは現状分析のみ。コードは一切変更していない。**

このファイルは3部構成Blueprintの1本目。他2本は `docs/ui-blueprint.md`(ページ一覧・遷移図・UXフロー)、`docs/architecture.md`(システム構成・データフロー)。3本合わせて Single Source of Truth として運用する。

---

## Step 1: 既存ドキュメントの調査結果

以下がリポジトリに既に存在した(**いずれも2026-07-02付近が最終更新で、以降の大規模改修=v5 UI/LP統合/算命学接続/月柱年柱ロジック/スコアリング刷新等が未反映**)。

| ファイル | 場所 | 内容概要 | 鮮度 |
|---|---|---|---|
| README.md | / | セットアップ手順・ディレクトリ概要 | 直近CEO更新あり |
| ARCHITECTURE.md | docs/ | システム構成(Next.jsフルスタック)・AI Development OS設計・DB設計・インフラ | 技術スタック部分は現行と一致。詳細は7/2版 |
| PRD.md / PROJECT_CHARTER.md | docs/ | プロダクト要求・プロジェクト憲章 | 初期方針、大枠は現行も有効 |
| DEVELOPMENT_RULES.md / AI_ROLE.md | docs/ | 開発ルール・AI役割分担 | 運用ルールとして現行も有効 |
| HANDOVER_2026-07-04.md | docs/ | 引き継ぎメモ | 7/4時点 |
| claude_impl_notes/01_ia.md | docs/ | IA(サイトマップ)要約 | **古い**: `/consult`がカテゴリ選択式だった頃の記述。v5でLP接続に変更済み |
| claude_impl_notes/02_screen-flow.md | docs/ | 画面遷移要約 | **古い**: 同上 |
| claude_impl_notes/03_data-layer.md | docs/ | データ層設計 | Prismaモデルは概ね一致(その後10モデル前後追加) |
| claude_impl_notes/04_requirements.md | docs/ | 要件定義要約 | 初期要件、大枠有効 |
| design/00_ceo_decisions/*.md (9本) | docs/design/ | CEO決定事項(占術ロジック割当・UI/UX仕様v5・課金定義等) | **これが実質の仕様の正典**。個々は最新 |
| design/01〜08/*.md (約20本) | docs/design/ | 競合分析・ブランド戦略・決定レポート設計・会話設計・スケール設計・トークション仕様 | 各領域の設計原典として現行も有効 |
| prompts/**/*.md | prompts/ | LLMプロンプト(占術分析基礎・キャラクター・タスク定義) | 現行運用中 |

**判断**: IA/画面遷移の要約(01_ia.md, 02_screen-flow.md)は実装から乖離しているため、本Blueprintで**全面的に置き換える**。CEO決定事項群(00_ceo_decisions)は仕様の正典として維持し、本Blueprintはそれらの「実装済み状態のスナップショット」と位置づける。

---

## ① プロジェクト全体構成

「糸町の少年」は、Next.js 14(App Router)による**フルスタック1リポジトリ構成**の占いWebサービス。フロントエンド・BFF・占術計算エンジンが同一コードベースに同居し、外部サービス(Supabase/Postgres、Upstash Redis、Stripe、Sakana AI/OpenAI)と連携する。

- **ドメイン**: 四柱推命・算命学・姓名判断・暦注(風水)を用いた日次運勢/相性/キャリア占い + AIチャット相談 + 電話占いオークション(トークション)
- **収益モデル**: サブスク(月額980円・チャット5回/日)+ クレジット追加購入 + トークション落札額
- **ユーザー種別**: 未ログイン / 無料会員(チャット1回/日) / 有料会員(チャット5回/日+追加購入)
- **キャラクター**: 「糸町の少年」(蛙のキャラクター)による一人称固定・占術用語非開示のチャット人格
- **世界観**: 天の川・提灯・藍色の夜という和風ファンタジー(MilkyWayBackground共通コンポーネントで全画面統一)

---

## ② ディレクトリ構成

```
fortune_verify/
├─ src/
│  ├─ app/                      # Next.js App Router(ページ+APIルート)
│  │  ├─ (25 ページディレクトリ)  # 詳細はui-blueprint.md ページ一覧参照
│  │  ├─ api/                   # 34 Route Handlers(BFF層)
│  │  │  ├─ auth/               # login, signup, logout, me
│  │  │  ├─ chat/                # 占いチャット(会員種別クォータ制御込み)
│  │  │  ├─ report/today/        # 今日の運勢(期間別: today/week/month/nextMonth)
│  │  │  ├─ self, love, work/reading  # 3診断の占いエンジン接続API
│  │  │  ├─ billing/             # subscribe, credit, webhook, auction/bid
│  │  │  ├─ auction/              # 一覧・入札・決済・予約・自動終了(cron)
│  │  │  ├─ calendar, calendar/fengshui  # 四柱×暦注カレンダー
│  │  │  ├─ shrines, ranking, referral, weather
│  │  │  ├─ profile/avatar        # アバター画像設定
│  │  │  ├─ admin/                # 運営ダッシュボード用API
│  │  │  ├─ notifications/        # 設定・評価バッチ(cron)
│  │  │  └─ health                # 死活監視
│  │  ├─ layout.tsx               # 全ページ共通シェル(Header+BottomNav常設)
│  │  └─ globals.css              # デザイントークン実体・.inputクラス等
│  │
│  ├─ components/                 # 共通UIコンポーネント(10ファイル。詳細は⑦)
│  ├─ lib/
│  │  ├─ fortune-engine/           # 占術計算コア(11ファイル。詳細はarchitecture.md)
│  │  ├─ decision-report/          # 「今日の運勢」生成パイプライン(scoring/environment/knowledge/index)
│  │  ├─ auth.ts, db.ts, db-replica.ts, redis.ts, stripe.ts, weather.ts
│  │  ├─ analytics.ts, experiments.ts, feature-store.ts  # スケール期の分析基盤
│  │  ├─ calendar-adapter.ts, recommendation.ts, talkauction.ts, password.ts
│  │  └─ (合計28ファイル)
│  └─ generated/prisma/            # Prisma Client自動生成物(gitignore対象)
│
├─ prisma/
│  ├─ schema.prisma                # 25モデル(詳細はarchitecture.md データモデル)
│  └─ manual_*.sql                 # 手動マイグレーション(Supabase適用用)
│
├─ public/
│  ├─ character/                   # キャラクター画像(ホーム/レポートヒーロー等)
│  └─ report-ui/index.html         # v4 LP静的配信(itomachi_report_ui_v4と同期運用)
│
├─ prompts/
│  ├─ chat/system_prompt.v2.4.md   # キャラクター人格プロンプト(Layer1)
│  ├─ analysis/                    # 占術分析基礎プロンプト(Layer0)+算命学インデックスJSON
│  └─ content/                     # ネクストアクションテンプレート
│
├─ docs/                           # 設計ドキュメント(本Blueprint含む)
│  └─ design/00_ceo_decisions〜08_talkauction/  # CEO決定・競合分析・ブランド・スケール設計等
│
├─ scripts/integration_test.sh     # 結合テスト(86項目)
├─ next.config.mjs, tailwind.config.ts, prisma.config.ts
└─ vercel.json                     # Cron設定(オークション自動終了・通知評価バッチ)
```

**担当分界**: `app/`=画面とBFF、`lib/fortune-engine/`=占術の数式・辞書そのもの(UIに依存しない純粋関数群)、`lib/decision-report/`=占術結果をレポート形式に合成する中間層、`components/`=見た目の再利用部品。

---

## ⑦ 共通コンポーネント一覧

| コンポーネント | 役割 | 主な利用ページ |
|---|---|---|
| `Header.tsx` | 全画面共通ヘッダー。ハンバーガーメニュー(18項目)+人マーク(ログイン状態でアバター/頭文字/アイコン切替) | 全ページ(layout.tsx) |
| `BottomNav.tsx` | 下部固定ナビ(ホーム/占い相談/お知らせ/マイページ)。LP(v4)のマスターデザインと統一 | 全ページ(layout.tsx) |
| `MilkyWayBackground.tsx` | 天の川背景+控えめな流れ星演出(端のみ・7-16秒間隔) | ホーム・自分のこと・恋愛・仕事 |
| `HomeGreeting.tsx` | 3軸(天気×四柱)スコアリングによる挨拶文表示 | ホーム |
| `ScoreOrb.tsx` | 円環スコアメーター(★+点数のドーナツ表示) | ホーム・今日の運勢 |
| `ChatWindow.tsx` | 占いチャットUI(送受信・402/409/401分岐対応) | /consult(有料会員直行時) |
| `AvatarUploader.tsx` | 画像選択→256px正方形縮小→アップロード | マイページ |
| `PopularRanking.tsx` | 人気占いランキング表示 | ホーム |
| `ShareButtons.tsx` | SNS共有(X/Instagram/TikTok/LINE) | 結果共有ページ |
| `ui-common.tsx` | 汎用部品集約: `GlassMosaic`(有料壁のぼかし), `ScrollProgress`, `FloatingCTA`, `ShareRow`, `AffSlot`(アフィ余白枠) | レポート・自分のこと・恋愛・仕事・神社詳細等ほぼ全診断系ページ |

---

## ⑧ デザインシステム

### カラー(tailwind.config.ts extend.colors)
| トークン | 値 | 用途 |
|---|---|---|
| `ink-950` | `#101026` | 背景最深部(夜の社) |
| `ink-900` | `#15152F` | カード背景 |
| `ink-800` | `#1E1E3D` | サブ背景 |
| `ink-700` | `#2A2A52` | ボーダー |
| `gold-400/500/600` | `#E4BE5C` / `#D9A62E` / `#B8871E` | 灯籠の金(CTA・アクセント) |
| `torii-500/600` | `#C1443C` / `#A5342D` | 鳥居の朱(強調・警告系) |
| `paper-50/200/400/600` | `#F7F3E9`〜`#847C9C` | テキスト濃淡4段階 |
| `rose-*` | Tailwind標準 | 恋愛系ページのアクセント(love/page.tsx) |

### タイポグラフィ
- `font-display`: `var(--font-shippori)`(明朝体・見出し用)
- `font-body`: `var(--font-zenkaku)`(角ゴシック・本文用)
- `font-mono`: 等幅(コード的表示用)

### Spacing / Corner / Shadow
- `rounded-card`: `20px`(カード共通角丸)
- `shadow-lantern`: `0 0 40px -8px rgba(217,166,46,.35)`(灯籠の淡い金光彩。CTAボタン等)
- CTAボタンは共通で `shadow-[0_4px_0_#8a6b25]` の疑似立体(押下で`translate-y-0.5`)

### アイコン
- 下部ナビ: 絵文字ベース(⌂💬🔔👤)でLP(v4)と本体が統一
- ヘッダー人マーク: lucide-react `User`アイコン(未ログイン時)/ アバター画像 or ひらがな頭文字(ログイン時)

### アニメーション
- 診断結果の演出待機: 600ms(2026-07-07に1800msから短縮)
- LP初回ローディング: 1900ms
- 流れ星: 7-16秒間隔・端のみ出現(控えめ)

---

## ⑩ システムアーキテクチャ(概要)

詳細は `docs/architecture.md` を参照。ここでは要素の一覧のみ:

- **Frontend**: Next.js 14 App Router + React 18 + TypeScript + Tailwind CSS
- **Backend(BFF)**: Next.js Route Handlers(`src/app/api/**`、34エンドポイント)。フロントと同一デプロイ単位(Vercel)
- **Database**: PostgreSQL(Supabase管理)+ Prisma ORM(25モデル)
- **Cache/Rate-limit**: Upstash Redis(REST API)。日次クォータカウンタ・ロック用
- **AI**: 3段フォールバック(Sakana AI → OpenAI gpt-4o-mini → 辞書ベースのフォールバック生成)
- **決済**: Stripe(サブスク・クレジット・トークション決済、Webhook即時反映)
- **認証**: 自前実装(Cookieセッション・24時間有効・bcryptハッシュ)
- **静的配信**: `public/report-ui/index.html`(LP、v4モックと同期運用)
- **監視/バッチ**: Vercel Cron(トークション自動終了5分毎・通知評価バッチ日次)、`/api/health`

---

## ⑬ 気付いたこと(現状分析のみ・改善提案は含まない)

1. **`/consult` は物理的にはページだが実質リダイレクタ**: サーバーコンポーネントでログイン状態→有料会員なら`/report`へ、それ以外はLP静的HTMLへ`redirect()`する薄い分岐ロジックのみ。UIを持たない特殊なルート。
2. **2つのLP実体が並存**: `public/report-ui/index.html`(本番配信)と `/mnt/user-data/outputs/itomachi_report_ui_v4.html`(編集元)を手動`cp`で同期する運用。Next.jsのビルドパイプラインには入っていない静的ファイル。
3. **`src/lib/fortune-engine/` と `src/lib/decision-report/` の2層構造**: 前者が占術そのものの計算(四柱推命・算命学・姓名判断・暦注・ホロスコープ・危機検知)、後者がそれらを合成してレポート文章・スコアにする層。責務は分離されているが、呼び出し関係はやや複雑(decision-report/index.tsが5つの占術関数を横断的に呼ぶ)。
4. **スコアリングロジックは2026-07-07に全面改訂済み**(`scoring.ts`)。四柱推命の月柱・年柱を新設し、7要素の加重合成+統計的リスケールで正規分布に近い分布(平均50・標準偏差16)を実現。旧ロジックとの後方互換フィールド(`base`/`envModifier`/`themeBonus`)がinterfaceに残存している。
5. **DailyReportはユニーク制約`(userId, reportDate)`でキャッシュされる**: 占術ロジックを変更しても、過去に生成済みのレポートは再計算されない。ロジック変更のたびに手動`DELETE FROM daily_reports`が運用上必要になっている(実際に本セッション内で複数回発生)。
6. **avatar列など、Prismaスキーマ変更と本番DB(Supabase)反映の間にタイムラグがある**: `findUnique`が全カラムSELECTする書き方だと、未反映のカラムがあるだけで該当APIが軒並み500になる障害が過去に発生。現在は主要APIで`select`を明示する対応済みだが、新規カラム追加時は同種のリスクが再発しうる構造。
7. **認証は独自実装**: NextAuth等のライブラリは使わず、Cookie+bcryptの自前実装。セッション24時間・`getCurrentUserId()`/`requireUserId()`という2種のヘルパーで任意/必須を使い分けている。
8. **アフィリエイト枠(`AffSlot`)は全ページに配置済みだが中身は未実装**: 「配置ルール(1セクション→下1枠/3セクション以上→中央+下)」に従った余白のみで、広告タグ等の実装はまだない。
