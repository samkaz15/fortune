# 糸町の少年 — System Architecture & Data Flow

作成日: 2026-07-07 / 対象コミット: f18819d
**本ドキュメントは現状分析のみ。コードは一切変更していない。**

3部構成Blueprintの3本目。1本目=`docs/project-structure.md`、2本目=`docs/ui-blueprint.md`。

---

## ⑨ データフロー(画面→Hooks→Service→API→AI→DB→Storage)

厳密な意味での「Hooks層」(カスタムReact Hooksの独立ファイル群)は本プロジェクトには存在せず、各ページコンポーネント内の`useEffect`/`useState`が直接`fetch`でAPIを叩く構成。代表例として「今日の運勢」のフルフローを示す。

```mermaid
flowchart TD
    UI["画面: /report (page.tsx)\nuseEffect内でfetch"] -->|"GET /api/report/today?period=..."| API["APIルート\nsrc/app/api/report/today/route.ts"]
    API -->|認証チェック| AUTH["lib/auth.ts requireUserId()"]
    API -->|"プロフィール取得(select限定)"| DB1[("Prisma → PostgreSQL\nuser_profiles")]
    API -->|"既存レポート照会\n(userId,reportDate)一意"| DB2[("daily_reports")]
    DB2 -->|キャッシュ有| API
    DB2 -->|キャッシュ無| ENGINE["lib/decision-report/index.ts\ngenerateDailyReport()"]

    ENGINE --> SHICHU["fortune-engine/shichu.ts\n日柱/月柱/年柱の計算"]
    ENGINE --> SANMEI["fortune-engine/sanmei.ts\n算命学(才能・志向)"]
    ENGINE --> ENV["decision-report/environment.ts\n天気→行動キーワード翻訳"]
    ENGINE --> SCORING["decision-report/scoring.ts\n7要素統計的合成スコア"]
    ENGINE --> KNOWLEDGE["decision-report/knowledge.ts\n過去の相談内容の要約参照"]

    SCORING -->|score,stars,breakdown| LLM_GATE{"LLM層を試行"}
    LLM_GATE -->|プロンプト2層合成| SAKANA["fortune-engine/sakana-ai-adapter.ts"]
    SAKANA -->|"1.Sakana AI(URL未設定なら省略)"| SAKANA_API["外部: Sakana AI"]
    SAKANA -->|"2.失敗/未設定→OpenAI"| OPENAI["外部: OpenAI gpt-4o-mini"]
    SAKANA -->|"3.失敗→辞書ベース"| FALLBACK["decision-report/index.ts\nbuildFallbackReport()\n4帯×日干解釈辞書"]

    FALLBACK -->|score,summary,advice等| SAVE["prisma.dailyReport.create/find"]
    SAKANA -->|同上| SAVE
    SAVE --> DB2
    SAVE -->|"trackEvent()"| ANALYTICS[("analytics_events")]
    API -->|JSON| UI
```

**Storage層について**: 画像アセット(キャラクター画像・アバター)はファイルストレージサービスを使わず、**アバターはdata URL(base64)としてPostgres列に直接保存**、キャラクター画像は`public/character/`の静的ファイルとしてVercelのCDN配信に委ねている。専用オブジェクトストレージ(S3等)は未導入。

---

## ⑩ システムアーキテクチャ(詳細)

```mermaid
flowchart TB
    subgraph Client["クライアント"]
        BROWSER["ブラウザ(モバイル優先レスポンシブ)"]
    end

    subgraph Vercel["Vercel(Frontend + BFF、単一デプロイ)"]
        NEXT["Next.js 14 App Router\nReact Server Components + Client Components"]
        API_ROUTES["Route Handlers(34本)\nsrc/app/api/**"]
        STATIC["静的配信\npublic/report-ui/index.html(LP)\npublic/character/*.jpg"]
        CRON["Vercel Cron\nauction/close(5分毎)\nnotifications/evaluate(日次)"]
    end

    subgraph DataLayer["データ層"]
        SUPABASE[("Supabase(PostgreSQL)\n25モデル・prisma管理")]
        REPLICA["lib/db-replica.ts\n読み取りレプリカ接続層(スケール期用)"]
        REDIS[("Upstash Redis\n日次クォータ・ロック")]
    end

    subgraph External["外部サービス"]
        STRIPE["Stripe\nサブスク/クレジット/オークション決済\nWebhook即時反映"]
        SAKANA2["Sakana AI(本命LLM)"]
        OPENAI2["OpenAI gpt-4o-mini(予備LLM)"]
        WEATHER_API["天気API(気圧取得)"]
        LINE["LINE公式(お問い合わせ導線)"]
    end

    subgraph Auth["認証"]
        COOKIE["Cookieセッション(24h)\nbcryptパスワードハッシュ\nlib/auth.ts / lib/password.ts"]
    end

    BROWSER -->|HTTPS| NEXT
    NEXT --> API_ROUTES
    BROWSER -.->|静的HTML直接配信| STATIC
    API_ROUTES --> Auth
    API_ROUTES --> SUPABASE
    API_ROUTES --> REDIS
    API_ROUTES --> REPLICA
    API_ROUTES --> STRIPE
    API_ROUTES --> SAKANA2
    API_ROUTES --> OPENAI2
    API_ROUTES --> WEATHER_API
    STATIC -.->|フッターリンク| LINE
    CRON --> API_ROUTES
    STRIPE -->|Webhook| API_ROUTES
```

**特記事項**:
- Frontend/BackendがVercel上の**単一デプロイ**に統合されており、マイクロサービス的な分割はない
- `db-replica.ts`はスケール期(GM10設計)を見越した読み取り分散の準備層で、現行トラフィック規模では実質シングルDB接続と同義
- 認証は外部IDaaS(Auth0等)を使わない自前実装

---

## ⑪ コンポーネント依存関係(主要部分)

```mermaid
flowchart LR
    LAYOUT["app/layout.tsx"] --> HEADER["components/Header.tsx"]
    LAYOUT --> BOTTOMNAV["components/BottomNav.tsx"]

    HEADER -->|"GET /api/auth/me"| ME_API["api/auth/me"]
    HEADER -.avatar-updatedイベント.-> AVATAR_UP["components/AvatarUploader.tsx"]

    HOME["app/page.tsx"] --> MILKYWAY["components/MilkyWayBackground.tsx"]
    HOME --> GREETING["components/HomeGreeting.tsx"]
    HOME --> ORB1["components/ScoreOrb.tsx"]
    HOME --> RANKING["components/PopularRanking.tsx"]
    HOME --> AFFSLOT1["components/ui-common.tsx (AffSlot)"]

    REPORT["app/report/page.tsx"] --> ORB2["components/ScoreOrb.tsx"]
    REPORT --> UICOMMON["components/ui-common.tsx\n(GlassMosaic,ScrollProgress,ShareRow,AffSlot)"]

    SELF["app/self/page.tsx"] --> MILKYWAY
    LOVE["app/love/page.tsx"] --> MILKYWAY
    WORK["app/work/page.tsx"] --> MILKYWAY
    SELF --> UICOMMON
    LOVE --> UICOMMON
    WORK --> UICOMMON

    MYPAGE["app/mypage/page.tsx"] --> AVATAR_UP
    AVATAR_UP -->|"POST /api/profile/avatar"| AVATAR_API["api/profile/avatar"]

    RESULT["app/result/[id]/page.tsx"] --> SHAREBTN["components/ShareButtons.tsx"]

    GREETING -->|"GET /api/home/greeting"| GREETING_API["api/home/greeting"]
```

**依存の性質**: `ui-common.tsx`(GlassMosaic/ScrollProgress/ShareRow/AffSlot)が事実上「診断系ページ共通のCVRキット」として最も広く再利用されている。`MilkyWayBackground`は世界観統一のための純粋な装飾コンポーネントで、ロジックへの依存はない。

---

## データモデル一覧(25モデル、Prisma)

| モデル | 役割 |
|---|---|
| User / UserProfile | 認証情報とPII(氏名・生年月日等)を分離した1:1構成 |
| FortuneSession / FortuneMessage / FortuneResult | チャット占いのセッション・メッセージ・結果 |
| DailyUsage | 日次利用回数カウンタ(Redis正・DB副の二重化) |
| DailyReport | 「今日の運勢」の生成結果キャッシュ。`(userId,reportDate)`一意制約 |
| Subscription | サブスク状態(status=active等) |
| CreditBalance / CreditTransaction | 追加クレジット残高・履歴 |
| PointBalance / PointTransaction | ポイント残高・履歴(クォータ超過時の中間消費層) |
| AuctionTicket / Bid / AuctionReservation / AuctionReview | トークション(オークション形式電話占い)の一式 |
| NotificationSetting / NotificationLog | 通知設定・送信履歴 |
| Shrine / ShrineReview | 神社情報(media列で画像/動画/SNS対応)・運営レビュー |
| KnowledgeEntry | チャット内容の要約蓄積(レポート生成時の文脈参照用) |
| AnalyticsEvent / UserFeature / ExperimentAssignment | スケール期の分析基盤(イベントログ・特徴量・A/Bテスト割当) |
| AuditLog | 監査ログ |

---

## 主要な設計原則(コードコメントから抽出)

1. **占術の内訳を絶対にユーザーへ開示しない**: 「四柱推命」「算命学」等の用語はUIに出さず、キャラクター(糸町の少年)の言葉に翻訳して伝える
2. **AIはスコアを決めない**: スコアリングはルールベース(`scoring.ts`)で決定論的に算出し、LLMは解釈・文章生成のみを担当する(監査可能性の確保)
3. **気象値の生表示禁止**: 気圧等の生値をLLMに渡さず、`environment.ts`で人間行動キーワードに事前翻訳してから渡す
4. **3段フォールバックでサービスを止めない**: LLM層はSakana AI→OpenAI→辞書ベースの順で必ず何かを返す設計
5. **DBカラム追加時は`select`明示が必須**(運用上の教訓): `findUnique`の全カラム取得は、本番マイグレーション未適用時に該当API全体を500にする実障害を過去に起こしている
