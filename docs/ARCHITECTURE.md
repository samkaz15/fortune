# System Architecture & AI Development OS Design

> **⚠️ このドキュメントはv2として全面書き換えされています。**
> 旧版はPython/FastAPI + SQLAlchemy + Terraform/Kubernetesを前提に書かれていましたが、
> **実装は一切存在せず、方針が文書化されていただけ**でした。一方Claudeは並行して
> Next.js(App Router) + Prisma + PostgreSQLで**実際に動くPhase1実装**を完了させています。
> 「先に動くものがある方を正とする」という判断のもと、本ドキュメントは実装済みの
> Next.jsフルスタック構成に合わせて書き換えています。旧版の技術方針(FastAPI等)は不採用です。
> AI Development OSとしての設計思想(複数AIの役割分担・成果物受け渡し・GitHub中心の版管理)は
> 技術スタックに依存しないため、そのまま引き継いでいます。

## 目次
1. [全体アーキテクチャ](#全体アーキテクチャ)
2. [AI Development OS の設計](#ai-development-osの設計)
3. [バックエンド・システムアーキテクチャ](#バックエンド・システムアーキテクチャ)
4. [データベース設計](#データベース設計)
5. [インフラストラクチャ](#インフラストラクチャ)
6. [セキュリティ・スケーラビリティ](#セキュリティ・スケーラビリティ)

---

## 全体アーキテクチャ

### Next.js フルスタック構成（フロントエンドとバックエンドを1リポジトリに統合）

```
┌─────────────────────────────────────────────────────────┐
│                      ユーザーアプリケーション              │
│         Next.js 14 (App Router) + TypeScript             │
│         Web: レスポンシブ / モバイルファースト              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Route Handlers)         │
│         src/app/api/** — BFFを兼ねるサーバーサイド層        │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────┬────────┬──────────┬───────────┐
        ↓         ↓        ↓          ↓           ↓
    ┌────────┐┌────┐┌────────┐┌──────┐┌────────┐
    │Auth    ││Chat││Fortune ││Pay   ││Weather ││
    │(暫定)  ││API ││Engine  ││(x3)  ││API     ││
    └────────┘└────┘└────────┘└──────┘└────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Data Layer                                 │
│  PostgreSQL(Prisma) | Redis(Upstash) | Stripe(決済)    │
└─────────────────────────────────────────────────────────┘
```

**フロントエンドとバックエンドを分離しなかった理由**：Phase1はソフトローンチ規模であり、
別サービス化(FastAPI等)による運用コスト(コンテナ管理・サービス間通信・型の二重管理)が
開発速度に見合わない。Next.js API RoutesはTypeScriptの型をフロントと共有できるため、
小〜中規模では素直に有利。Phase3(数百万人規模)で特定の処理(占術エンジン・推薦ロジック等)
だけを別サービスに切り出す判断は妥当だが、それは「先に分割ありき」ではなく負荷実測後に行う。

---

## AI Development OS の設計

（この章はPROJECT_CHARTER.mdの構想を踏襲。技術スタック非依存のため変更なし）

### 概念図

```
┌──────────────────────────────────────────────────────────┐
│                  GitHub Repository                       │
│         (Single Source of Truth for all artifacts)      │
│  - Code / Tests / Docs / Prompts / Infrastructure       │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│            AI Development OS Orchestrator                │
│              (Coordinates all AI agents)                 │
└──────────────────────────────────────────────────────────┘
           ↓
    ┌──────┴──────┬──────────┬──────────┬────────────┐
    ↓             ↓          ↓          ↓            ↓
┌──────────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌────────────┐
│  Claude  │ │ChatGPT│ │ Gemini │ │Sakana │ │ Future AI  │
│(Core)    │ │(Text) │ │(Search)│ │(ML)   │ │ (Domain)   │
└──────────┘ └──────┘ └────────┘ └───────┘ └────────────┘
```

### AI ごとの役割定義

| AI | 主な責務 | 入力 | 出力 | 連携点 |
|---|---|---|---|---|
| **Claude** | 設計・実装・レビュー | Issue/PR/設計書 | コード/設計書 | GitHub |
| **ChatGPT** | 要件化・文案・プロンプト | ビジネス要件 | PRD/プロンプト | GitHub |
| **Gemini** | 市場調査・競合分析 | キーワード | 分析レポート | GitHub/Docs |
| **Sakana AI** | 推薦・スコアリング | ユーザー行動 | モデル・スコア公式 | API |

詳細は [AI_ROLE.md](./AI_ROLE.md) を参照。

### 実装済みの成果物受け渡し例（Phase1）

```
[Gemini] GM1〜GM8 競合分析・調査
    ↓ (docs/design/01_competitive_analysis/)
[ChatGPT] GPT1 キャラクター設定「ツクヨミ」
    ↓ (docs/design/02_brand_strategy/GPT1_character_design.md)
[ChatGPT] GPT3 チャットプロンプト設計
    ↓ (prompts/chat/GPT3_chat_prompt_design.md → system_prompt.v1.0.md に切り出し)
[Claude] CL8 占術統合エンジン実装
    → src/lib/fortune-engine/index.ts が system_prompt.v1.0.md を実行時に読み込む
[ChatGPT] GPT4 ネクストアクション文言テンプレート
    ↓ (prompts/content/GPT4_next_action_templates.md → next_action_templates.v1.0.json に構造化)
[Claude] CL9 占いチャット実装
    → src/lib/fortune-engine/sakana-ai-adapter.ts のモック応答が同JSONを参照
```

この一連の流れが、実際に「ドキュメント成果物 → 実装への取り込み」まで機能した最初の実例。

---

## バックエンド・システムアーキテクチャ

### 技術スタック（実装済み）

```
言語: TypeScript
フレームワーク: Next.js 14 (App Router)
ORM: Prisma 5
DB: PostgreSQL(Supabase推奨)
キャッシュ/カウンター: Redis(Upstash推奨)
決済: Stripe
バリデーション: Zod
```

### 層構造（実装対応）

```
src/app/            画面(Level1〜4) + APIルート(src/app/api/**)
src/components/      共通UI(Header/BottomNav/ChatWindow/ScoreOrb等)
src/lib/
  fortune-engine/    占術統合エンジン(CL8) — 姓名判断/算命学/四柱推命/ホロスコープ
                     + crisis-detection.ts(安全ガードレール Layer2)
                     + sakana-ai-adapter.ts(外部AI呼び出し層)
  db.ts              Prismaクライアント(シングルトン)
  redis.ts           カウンター・キャッシュ・分散ロック
  stripe.ts          決済クライアント
  weather.ts         天気連携(CL12)
  auth.ts            認証(暫定実装。Supabase Auth移行が残タスク)
prisma/schema.prisma DB設計(CL7)
prompts/             AIプロンプトのバージョン管理(GPT3方針に準拠)
```

### 主要モジュールの責務（実装対応表）

| 旧ARCHITECTURE.mdでの呼称 | 実装での対応 |
|---|---|
| AuthService | `src/lib/auth.ts` + `src/app/api/auth/*`（暫定Cookie実装。Supabase Auth移行が残タスク） |
| DivinationService | `src/lib/fortune-engine/`（CL8で実装済み） |
| ChatService | `src/app/api/chat/route.ts` + `ChatWindow.tsx` |
| PaymentService | `src/app/api/billing/*` + `src/app/api/billing/webhook`(Stripe Webhook) |
| NotificationService | 未実装（Phase2 CL17で実装予定） |
| RecommendationService | 未実装（Phase2 CL19で実装予定、Sakana AI連携強化） |

### API 設計規約（実装での実際の形）

旧版は `/api/v1/...` + `{status, code, data, error, pagination}` の統一レスポンス形式を
想定していたが、Next.js Route HandlerではフロントエンドとAPIが同一TypeScriptプロジェクト内にあり、
型を直接共有できるため、**エンベロープを持たない直接JSON返却**を採用している
（例：`{ sessionId, resultId, message }` を直接返す。エラー時は `{ error: "CODE", message?: string }`）。
これは意図的な逸脱であり、REST APIとして外部公開する必要が生じた場合(Phase3でモバイルアプリ等が
増える場合)は、`/api/v1/`プレフィックス+統一エンベロープへの移行を検討する。

---

## データベース設計

### 実装済みスキーマ（詳細は `prisma/schema.prisma` を参照）

旧版の簡略ERD（User / Divination / Chat / Payment / Notification の5テーブル）に対し、
実装では要件が明らかになった時点でより詳細な構造に分割している。対応関係は以下の通り。

| 旧ERDのテーブル | 実装での対応 | 分割した理由 |
|---|---|---|
| User | `User` + `UserProfile` | PII(氏名・生年月日等)を専用テーブルに隔離し、匿名化・削除要求への対応を容易にするため |
| Divination | `FortuneSession` + `FortuneMessage` + `FortuneResult` | チャット形式の対話履歴と、確定した診断結果を分離するため |
| Payment | `Subscription` + `CreditBalance`/`CreditTransaction` + `AuctionTicket`/`Bid` | 3つの課金モデル(サブスク/クレジット/オークション)は整合性要件が異なるため統合しなかった。特にオークションは`version`列による楽観ロックが必要 |
| Notification | `NotificationSetting` | Phase1は設定のみ。送信履歴テーブルはPhase2の通知高度化(CL17)で追加する |
| (新規) | `DailyUsage`, `AuditLog` | 利用回数カウンターの整合性チェック用、および監査ログ(追記専用) |

### スケーラビリティを考慮した設計

Phase1〜2は単一PostgreSQLインスタンス(Read Replica任意)で問題ない規模。
Phase3(数百万人規模)での水平分割(シャーディング)は、`userId`をシャードキーとする方針を維持する
(旧ARCHITECTURE.mdの方針を踏襲)。ただし実装はPhase3着手時に行う。

### キャッシング戦略（実装対応）

```
Redis (Upstash)
├─ 利用回数カウンター(1日5回)    TTL: 26時間（日付またぎのバッファ込み）
├─ 生成中の二重送信防止ロック     TTL: 30秒
├─ 天気情報                     TTL: 3時間
└─ (Phase2以降) ランキング・APIレスポンスキャッシュ
```

---

## インフラストラクチャ

### 推奨構成（Phase1〜2）

旧版はAWS/GCP + Terraform + Docker/Kubernetesを前提にしていたが、Phase1〜2の規模では
過剰投資になるため、サーバーレス・マネージドサービス中心の構成を推奨する。

```
Next.js アプリ         → Vercel（デプロイ・CDN・自動スケールを一括提供）
PostgreSQL            → Supabase（マネージド、Auth機能も将来利用可）
Redis                 → Upstash（サーバーレス従量課金、Vercelとの相性が良い）
決済                   → Stripe
```

### Phase3以降で検討する構成

数百万人規模に達した段階で、以下への移行を検討する(旧ARCHITECTURE.mdの構想を踏襲)。

```
- コンテナ化・Kubernetes導入（特定の重い処理を切り出す場合）
- Terraformによるインフラのコード化
- マルチリージョン展開
- 読み取り専用レプリカの追加、または水平分割(シャーディング)
```

「先に大きなインフラを組む」のではなく、**実測に基づいて必要になった箇所から段階的に移行する**
方針は旧版から変更していない。

---

## セキュリティ・スケーラビリティ

### 認証・認可

Phase1時点では簡易Cookie認証（`src/lib/auth.ts`）。本番投入前に **Supabase Auth** への
移行が必須（JWTベースのアクセストークン/リフレッシュトークン運用は旧版の方針を踏襲する）。

### データ暗号化

```
転送中: TLS（Vercel/Supabase双方で標準対応）
保存時: Supabase側のディスク暗号化 + 機微カラムの追加暗号化を検討(Phase2)
個人情報: UserProfile テーブルへの隔離により、アクセス経路を限定
```

### API セキュリティ（実装状況）

```
入力バリデーション: Zod（実装済み・全APIルートで使用）
決済の整合性: Stripe Webhook経由でのみ確定(クライアントの成功コールバックを信用しない)
オークション同時実行制御: 楽観ロック(version列)で実装済み
レート制限: 未実装(Phase2で追加。Vercel/Upstashのレート制限機能を利用予定)
```

### 負荷テスト目標（旧版の方針を踏襲）

```
Phase 1: 1,000 同時接続
Phase 2: 10,000 同時接続
Phase 3: 100,000+ 同時接続
```

---

## 参考資料

- 実装コード: `src/`
- DB設計詳細: `prisma/schema.prisma`
- プロンプト: `prompts/`
- AI 連携: [AI_ROLE.md](./AI_ROLE.md)
- 実装ノート(Claude作業ログ): `docs/claude_impl_notes/`

**最終更新**: 2026-07-02（Next.js実装完了を反映した全面改訂）
