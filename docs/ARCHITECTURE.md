# System Architecture & AI Development OS Design

## 目次
1. [全体アーキテクチャ](#全体アーキテクチャ)
2. [AI Development OS の設計](#ai-development-osの設計)
3. [バックエンド・システムアーキテクチャ](#バックエンド・システムアーキテクチャ)
4. [データベース設計](#データベース設計)
5. [インフラストラクチャ](#インフラストラクチャ)
6. [セキュリティ・スケーラビリティ](#セキュリティ・スケーラビリティ)

---

## 全体アーキテクチャ

### プロダクト層とAI層の分離

```
┌─────────────────────────────────────────────────────────┐
│                      ユーザーアプリケーション              │
│  (Web: Next.js / Mobile: Flutter)                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                      REST API Gateway                    │
│                  (FastAPI + Uvicorn)                    │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────┬────────┬──────────┬───────────┐
        ↓         ↓        ↓          ↓           ↓
    ┌────────┐┌────┐┌────────┐┌──────┐┌────────┐
    │Auth    ││Chat││Divn    ││Pay   ││Notif   │
    │Service ││Svc ││Engine  ││Svc   ││Svc     │
    └────────┘└────┘└────────┘└──────┘└────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Data Layer                                 │
│  PostgreSQL (Primary) | Redis (Cache) | S3 (Files)    │
└─────────────────────────────────────────────────────────┘
```

---

## AI Development OS の設計

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

### ワークフロー: 要件 → 設計 → 実装 → テスト → リリース

```
┌─────────────────────────────────┐
│  1. 要件定義フェーズ              │
│  [Gemini] 市場調査                │
│  [ChatGPT] ビジネス要件化          │
└────────────┬────────────────────┘
             ↓
        ┌─────────────────────────────────┐
        │  GitHub Issue (PRD)              │
        │  Label: [phase], [feature]      │
        └────────────┬────────────────────┘
                     ↓
        ┌─────────────────────────────────┐
        │  2. 設計フェーズ                  │
        │  [Claude] アーキテクチャ設計      │
        │  [ChatGPT] UI/UX・プロンプト     │
        └────────────┬────────────────────┘
                     ↓
        ┌─────────────────────────────────┐
        │  GitHub (design branch)          │
        │  設計ドキュメント・図 commit      │
        └────────────┬────────────────────┘
                     ↓
        ┌─────────────────────────────────┐
        │  3. 実装フェーズ                  │
        │  [Claude] コード実装             │
        │  [ChatGPT] テストデータ生成      │
        └────────────┬────────────────────┘
                     ↓
        ┌─────────────────────────────────┐
        │  GitHub (feature branch)         │
        │  実装コード commit                │
        └────────────┬────────────────────┘
                     ↓
        ┌─────────────────────────────────┐
        │  4. テスト・レビューフェーズ      │
        │  [Claude] コードレビュー         │
        │  自動テスト実行                   │
        │  → PR Create                    │
        └────────────┬────────────────────┘
                     ↓
        ┌─────────────────────────────────┐
        │  5. リリース準備                  │
        │  [Claude] デプロイ準備           │
        │  本番環境へデプロイ               │
        └────────────┬────────────────────┘
                     ↓
                ✅ Released
```

---

## バックエンド・システムアーキテクチャ

### 技術スタック（推奨）

```
言語: Python 3.11+
フレームワーク: FastAPI
非同期: asyncio + aiohttp
ORM: SQLAlchemy 2.0
API Documentation: OpenAPI 3.0 (Swagger)
```

### 層構造（Layered Architecture）

```
┌──────────────────────────────────────────┐
│  API Layer (FastAPI Router)               │
│  - /api/v1/auth                          │
│  - /api/v1/divination                    │
│  - /api/v1/chat                          │
│  - /api/v1/payment                       │
│  - /api/v1/notification                  │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│  Service Layer (Business Logic)          │
│  - AuthService                           │
│  - DivinationService                     │
│  - ChatService                           │
│  - PaymentService                        │
│  - NotificationService                   │
│  - RecommendationService                 │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│  AI Integration Layer                    │
│  - ClaudeClient                          │
│  - OpenAIClient                          │
│  - GeminiClient                          │
│  - SakanaAIClient                        │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│  Data Access Layer (Repository Pattern)  │
│  - UserRepository                        │
│  - DivinationRepository                  │
│  - ChatRepository                        │
│  - PaymentRepository                     │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│  Database Layer                          │
│  - PostgreSQL (Primary)                  │
│  - Redis (Cache)                         │
│  - S3 (File Storage)                     │
└──────────────────────────────────────────┘
```

### 主要サービスの責務

#### AuthService
```
認証・認可・セッション管理
- ユーザー登録・ログイン
- JWT トークン管理（Access + Refresh）
- OAuth2 連携（Google/Apple ログイン）
```

#### DivinationService
```
占術エンジンの統合・実行
- 四柱推命・算命学・姓名判断の統合
- 占いスコア計算
- 毎日の運勢生成（バッチ）
```

#### ChatService
```
AI チャット相談機能
- OpenAI API 連携
- コンテキスト管理
- 応答のトーン制御
```

#### PaymentService
```
課金・決済処理
- サブスクリプション管理
- クレジット・追加購入
- オークション入札処理
```

#### NotificationService
```
プッシュ通知・スケジューリング
- FCM 連携（Firebase Cloud Messaging）
- 運気通知・95点通知
- スケジューリング・時間帯別配信
```

#### RecommendationService
```
推薦ロジック実行
- Sakana AI との連携
- ユーザー行動に基づく推薦
- 匿名データを活用した推薦
```

### API 設計規約

#### エンドポイント命名規約
```
GET    /api/v1/users/{user_id}           # 取得
POST   /api/v1/divinations              # 作成
PUT    /api/v1/users/{user_id}          # 更新全体
PATCH  /api/v1/users/{user_id}          # 部分更新
DELETE /api/v1/users/{user_id}          # 削除
```

#### レスポンスフォーマット
```json
{
  "status": "success" | "error",
  "code": "SUCCESS" | "VALIDATION_ERROR" | ...,
  "data": {...},
  "error": {
    "message": "...",
    "details": [...]
  },
  "pagination": {
    "total": 100,
    "page": 1,
    "per_page": 10
  }
}
```

#### エラーハンドリング
```python
class APIException(Exception):
    """API エラーベースクラス"""
    status_code: int
    error_code: str
    message: str

class ValidationError(APIException):
    status_code = 400
    error_code = "VALIDATION_ERROR"

class NotFoundError(APIException):
    status_code = 404
    error_code = "NOT_FOUND"

class PaymentError(APIException):
    status_code = 402
    error_code = "PAYMENT_FAILED"
```

---

## データベース設計

### 主要エンティティ（ER図簡略版）

```
User
├─ id (PK)
├─ email
├─ password_hash
├─ profile
├─ created_at
└─ updated_at

↓ (1:N)

Divination
├─ id (PK)
├─ user_id (FK)
├─ type (DAILY / CHARACTER / BUSINESS / COMPATIBILITY)
├─ input_params (JSON)
├─ result (JSON)
├─ score
├─ created_at
└─ updated_at

↓ (1:N)

Chat
├─ id (PK)
├─ user_id (FK)
├─ message
├─ ai_response
├─ context (JSON)
├─ created_at
└─ updated_at

↓ (1:N)

Payment
├─ id (PK)
├─ user_id (FK)
├─ type (SUBSCRIPTION / CREDIT / AUCTION_BID)
├─ amount
├─ status
├─ created_at
└─ updated_at

Notification
├─ id (PK)
├─ user_id (FK)
├─ type
├─ message
├─ sent_at
└─ read_at
```

### スケーラビリティを考慮した設計

#### Phase 1: 単一 PostgreSQL インスタンス
```
単一 DB サーバー
├─ Primary (読み書き)
└─ Replica (読み取りのみ)
```

#### Phase 3: 水平分割（Sharding）
```
Sharded Database
├─ Shard 0 (user_id hash % 10 = 0)
├─ Shard 1 (user_id hash % 10 = 1)
├─ ...
└─ Shard 9 (user_id hash % 10 = 9)

シャードキー: user_id
```

#### キャッシング戦略
```
Redis (In-Memory)
├─ User Session (TTL: 24h)
├─ Divination Result (TTL: 1h)
├─ Leaderboard (TTL: 15min)
└─ Feature Flags (TTL: 5min)
```

---

## インフラストラクチャ

### クラウド構成（AWS/GCP）

```
┌─────────────────────────────────────────┐
│  Internet                               │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  CloudFront / CDN                       │
│  (静的資源キャッシュ)                    │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Load Balancer (ALB / Cloud Load Bal.)  │
└────────┬──────────────┬──────────┬──────┘
         ↓              ↓          ↓
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │  Container │  │Container  │  │Container  │
    │ (FastAPI)  │  │(FastAPI)  │  │(FastAPI)  │
    └───────────┘  └───────────┘  └───────────┘
         ↓              ↓          ↓
┌─────────────────────────────────────────┐
│  RDS PostgreSQL (Primary)               │
│  + Read Replicas                        │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  ElastiCache / Redis                    │
│  (Session / Cache Store)                │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  S3 / Cloud Storage                     │
│  (ユーザーデータ / ログ)                 │
└─────────────────────────────────────────┘
```

### IaC（Infrastructure as Code）

```
terraform/
├─ main.tf              # VPC・セキュリティグループ
├─ rds.tf              # データベース
├─ elasticache.tf      # Redis
├─ ecs.tf              # コンテナ管理
├─ alb.tf              # ロードバランサー
├─ s3.tf               # ストレージ
└─ variables.tf        # 環境変数
```

### CI/CD パイプライン

```
GitHub Push
   ↓
[1] Lint + Format Check
   ├─ Ruff (Python linter)
   ├─ Black (Formatter)
   └─ mypy (Type checker)
   ↓
[2] Unit Tests
   ├─ Pytest
   └─ Coverage > 80%
   ↓
[3] Integration Tests
   ├─ Docker Compose で DB 立ち上げ
   └─ API テスト
   ↓
[4] Security Scan
   ├─ SAST (Bandit)
   └─ Dependency Check
   ↓
[5] Build Docker Image
   └─ ECR へ Push
   ↓
[6] Deploy to Staging
   └─ Terraform Apply
   ↓
[7] Smoke Tests (Staging)
   └─ E2E テスト
   ↓
[Optional] Deploy to Production
   └─ Manual Approval
```

---

## セキュリティ・スケーラビリティ

### セキュリティ方針

#### 認証・認可
```
JWT (JSON Web Token)
├─ Access Token (15分)
├─ Refresh Token (7日)
└─ Role-Based Access Control (RBAC)
```

#### データ暗号化
```
転送中: TLS 1.3
保存時: AES-256 (暗号化カラム)
個人情報: トークン化 / ハッシュ化
```

#### API セキュリティ
```
レート制限: 1000 req/min per IP
CORS: 指定ドメインのみ
CSRF: Double Submit Cookie
SQL Injection: Parameterized Queries (SQLAlchemy)
XSS: Content Security Policy (CSP)
```

### スケーラビリティ方針

#### 水平スケーリング
```
コンテナ数: 負荷に応じて自動スケール (HPA)
最小: 3 インスタンス
最大: 100 インスタンス
```

#### キャッシング戦略
```
L1: Browser Cache (1時間)
L2: CDN Cache (CloudFront)
L3: Application Cache (Redis)
L4: Database (PostgreSQL)
```

#### 負荷テスト目標
```
Phase 1: 1,000 同時接続
Phase 2: 10,000 同時接続
Phase 3: 100,000+ 同時接続
```

#### パフォーマンス目標
```
API レスポンスタイム: < 500ms (p95)
ページロード時間: < 2秒 (Web)
占い生成時間: < 3秒
チャット応答時間: < 5秒
```

---

## 参考資料

- API 仕様詳細: `/docs/technical/api_spec.yaml`
- DB 設計詳細: `/docs/design/database_design.md`
- インフラ詳細: `/infrastructure/`
- AI 連携: [AI_ROLE.md](./AI_ROLE.md)

**最終更新**: 2026-07-02
