# Development Rules & Guidelines

開発チーム（AI・メンバー）が従うべきルール、標準、ガイドラインを定めます。

---

## 目次
1. [Git ワークフロー](#git-ワークフロー)
2. [コーディング標準](#コーディング標準)
3. [テスト戦略](#テスト戦略)
4. [コードレビュー・PR プロセス](#コードレビュー・pr-プロセス)
5. [ドキュメント作成ルール](#ドキュメント作成ルール)
6. [GitHub Issue 管理](#github-issue-管理)
7. [デプロイメント](#デプロイメント)
8. [パフォーマンス・セキュリティチェックリスト](#パフォーマンス・セキュリティチェックリスト)

---

## Git ワークフロー

### ブランチ戦略

```
main (本番)
  ↑
  ├─ release/* (リリースブランチ)
  │  ├─ release/v1.0 (Phase1)
  │  ├─ release/v1.1 (Phase2)
  │  └─ release/v2.0 (Phase3)
  │
develop (開発メインライン)
  ↑
  ├─ feature/* (機能開発)
  │  ├─ feature/auth-system
  │  ├─ feature/divination-engine
  │  └─ feature/chat-service
  │
  ├─ design/* (設計ドキュメント)
  │  ├─ design/api-spec
  │  └─ design/db-schema
  │
  ├─ ai/* (AI プロンプト・エージェント)
  │  ├─ ai/prompt-divination
  │  └─ ai/prompt-chat
  │
  ├─ docs/* (ドキュメント更新)
  │  └─ docs/architecture-update
  │
  ├─ fix/* (バグ修正)
  │  └─ fix/session-token-expiry
  │
  └─ refactor/* (リファクタリング)
     └─ refactor/payment-service
```

### ブランチ命名規約

| タイプ | 命名例 | 説明 |
|---|---|---|
| Feature | `feature/auth-system` | 機能開発 |
| Design | `design/api-spec-v2` | 設計・仕様策定 |
| AI | `ai/prompt-fortun-generation` | AI プロンプト・エージェント改善 |
| Fix | `fix/user-profile-bug` | バグ修正 |
| Refactor | `refactor/payment-service` | リファクタリング |
| Docs | `docs/architecture-update` | ドキュメント更新 |

**命名規則:**
- snake_case
- 簡潔で機能を表現
- 最大20文字

### コミットメッセージ規約

#### フォーマット
```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type（必須）
```
feat       - 新機能
fix        - バグ修正
docs       - ドキュメント更新
style      - コード整形（機能変更なし）
refactor   - リファクタリング
perf       - パフォーマンス改善
test       - テスト追加・修正
chore      - ビルド・依存関係・ツール
ai         - AI プロンプト・エージェント更新
```

#### Scope（推奨）
```
auth, divination, chat, payment, notification, ui, db, api
```

#### Subject（必須）
- 命令形で記述: "add" / "fix" / "update"
- 最初は大文字
- ピリオド不要
- 50文字以内

#### Body（詳細な場合）
- なぜこの変更が必要か
- 何が変わったか
- 副作用の有無
- 72文字で折り返し

#### Footer
```
Closes #123              # GitHub Issue 参照
Breaks: API v1          # Breaking Changes
Reviewed-by: @reviewer  # レビュアー記載（AI生成の場合）
```

#### 例
```
feat(auth): implement JWT refresh token rotation

- Access token: 15分有効
- Refresh token: 7日有効
- 古い refresh token は無効化
- セッションテーブルで管理

Closes #45
```

### PR ルール

#### PR 作成時の必須項目
```markdown
## Description
[簡潔な説明]

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Closes #[issue-number]

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests passed
- [ ] E2E tests passed (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed own code
- [ ] No new warnings generated
- [ ] Added/updated documentation
```

#### PR マージ条件
- [ ] すべてのチェックが✅
- [ ] 最低1つのコードレビュー承認（AI・メンバー）
- [ ] CI/CD パイプライン成功
- [ ] テストカバレッジ > 80%（新規機能）

#### マージ後の処理
```bash
# feature ブランチは削除
git push origin --delete feature/xxx

# develop へ自動反映
# → staging 環境への自動デプロイ
```

---

## コーディング標準

### Python（Backend）

#### スタイルガイド
```
PEP 8 + Black（Formatter）
Line length: 100文字
Indentation: 4スペース
```

#### 必須ツール
```bash
# Linting
ruff check src/

# Formatting
black src/

# Type checking
mypy src/

# Security
bandit src/
```

#### ファイル構成
```
src/
├─ main.py              # FastAPI アプリケーション入点
├─ config.py            # 設定ファイル
├─ api/
│  ├─ routes/
│  │  ├─ auth.py
│  │  ├─ divination.py
│  │  └─ __init__.py
│  └─ schemas.py        # Pydantic models
├─ services/
│  ├─ auth_service.py
│  ├─ divination_service.py
│  └─ __init__.py
├─ models/
│  ├─ user.py
│  ├─ divination.py
│  └─ __init__.py
├─ db/
│  ├─ database.py
│  ├─ models.py         # SQLAlchemy models
│  └─ repositories.py
├─ ai/
│  ├─ claude_client.py
│  ├─ openai_client.py
│  ├─ gemini_client.py
│  └─ divination_engine.py
├─ utils/
│  ├─ auth.py
│  ├─ validators.py
│  ├─ logger.py
│  └─ error_handler.py
└─ batch/
   ├─ daily_divination.py
   └─ notification_scheduler.py
```

#### 命名規約
```python
# クラス: PascalCase
class UserService:
    pass

# 関数・変数: snake_case
def create_user(email: str) -> User:
    pass

# 定数: UPPER_SNAKE_CASE
MAX_RETRY_COUNT = 3
API_TIMEOUT_SECONDS = 30

# プライベート: アンダースコアプレフィックス
def _internal_helper():
    pass
```

#### 型ヒント（必須）
```python
from typing import Optional, List, Dict

def get_user(user_id: int) -> Optional[User]:
    """ユーザーを取得"""
    pass

def create_divination(
    user_id: int,
    params: Dict[str, str]
) -> Divination:
    """占いを生成"""
    pass
```

### TypeScript/React（Frontend）

#### スタイルガイド
```
ESLint + Prettier
Line length: 100文字
Indentation: 2スペース
```

#### 必須ツール
```bash
# Linting
eslint src/

# Formatting
prettier --write src/

# Type checking
tsc --noEmit
```

#### ファイル構成
```
src/
├─ components/
│  ├─ layout/
│  │  ├─ Header.tsx
│  │  └─ Sidebar.tsx
│  ├─ common/
│  │  ├─ Button.tsx
│  │  └─ Card.tsx
│  └─ features/
│     ├─ Auth/
│     ├─ Divination/
│     └─ Chat/
├─ pages/
│  ├─ index.tsx
│  ├─ login.tsx
│  └─ [id].tsx
├─ hooks/
│  ├─ useAuth.ts
│  └─ useDivination.ts
├─ services/
│  ├─ api.ts
│  └─ auth.ts
├─ types/
│  ├─ user.ts
│  └─ divination.ts
├─ styles/
│  ├─ globals.css
│  └─ variables.css
└─ utils/
   ├─ helpers.ts
   └─ validators.ts
```

#### 命名規約
```typescript
// コンポーネント: PascalCase
export const UserProfile: React.FC<Props> = () => {};

// Hook: camelCase + "use" prefix
export const useUserProfile = () => {};

// 型: PascalCase
interface User {
  id: string;
  name: string;
}

// 定数: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// 関数: camelCase
const formatDate = (date: Date): string => {};
```

---

## テスト戦略

### テストレベルと範囲

```
┌─────────────────────────────────────────┐
│  E2E Tests (Playwright)                 │
│  - ユーザージャーニー全体                 │
│  - UI インタラクション                   │
│  - カバレッジ: 重要フロー 100%          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Integration Tests                      │
│  - API エンドポイント                    │
│  - DB インタラクション                   │
│  - AI API 連携                          │
│  - カバレッジ: 60-70%                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Unit Tests (Pytest / Jest)             │
│  - 単一関数・クラス                      │
│  - ビジネスロジック                      │
│  - カバレッジ: > 80%                    │
└─────────────────────────────────────────┘
```

### テスト命名規約

```python
# Pytest
def test_create_user_with_valid_email():
    """正常系: 有効なメールでユーザー作成"""
    pass

def test_create_user_with_invalid_email():
    """異常系: 無効なメールでユーザー作成エラー"""
    pass

def test_create_user_duplicate_email_raises_error():
    """異常系: 重複したメールアドレスでエラー"""
    pass
```

```typescript
// Jest
describe("DivinationService", () => {
  it("should generate fortune for valid input", () => {
    // Arrange
    const input = { birthDate: "1990-01-01" };
    // Act
    const result = generateFortune(input);
    // Assert
    expect(result.score).toBeGreaterThan(0);
  });

  it("should throw error for invalid birth date", () => {
    // Arrange
    const input = { birthDate: "invalid-date" };
    // Act & Assert
    expect(() => generateFortune(input)).toThrow();
  });
});
```

### テストダブル戦略

#### Mock
```python
# AI API の Mock
@pytest.fixture
def mock_claude_client(mocker):
    return mocker.patch("src.ai.claude_client.ClaudeClient")
```

#### Stub
```python
# DB データの固定化
@pytest.fixture
def user_fixture(db):
    return User.objects.create(email="test@example.com")
```

#### 実テスト（Integration）
```python
# 実 DB での統合テスト
@pytest.mark.integration
def test_create_divination_with_real_db(client):
    response = client.post("/api/v1/divinations", json={...})
    assert response.status_code == 201
```

---

## コードレビュー・PR プロセス

### レビューフロー

```
[AI が PR を作成]
  ↓
[1] 自動チェック実行
  ├─ Linter / Type Checker
  ├─ Unit Tests
  ├─ Integration Tests
  └─ Security Scan
  ↓
[2] AI によるセルフレビュー
  ├─ Claude がコードをレビュー
  ├─ パフォーマンス・セキュリティ確認
  └─ ドキュメント確認
  ↓
[3] 人間によるピアレビュー
  ├─ 機能・ビジネスロジック確認
  ├─ アーキテクチャ整合性確認
  └─ コードスタイル最終確認
  ↓
[4] Merge & Deploy
  └─ CI/CD パイプライン実行
```

### レビューチェックリスト（AI用）

```markdown
## Code Quality
- [ ] 型ヒントが記述されている（Python/TS）
- [ ] 1関数 < 30行
- [ ] ネストが3階層以下
- [ ] 循環的複雑度が低い（< 10）

## Business Logic
- [ ] 仕様書の要件を満たしている
- [ ] エッジケースを処理している
- [ ] エラーハンドリングが適切

## Performance
- [ ] N+1 クエリがない
- [ ] キャッシング戦略を考慮している
- [ ] 大きなオブジェクトのメモリ使用を最適化

## Security
- [ ] 入力検証がある
- [ ] SQL インジェクション対策
- [ ] クロスサイトスクリプティング対策
- [ ] 認証・認可チェック

## Testing
- [ ] ユニットテストがある（カバレッジ > 80%）
- [ ] エッジケースのテストがある
- [ ] モック・スタブが適切に使用されている

## Documentation
- [ ] コメント・docstring が記述されている
- [ ] API ドキュメントが更新されている
- [ ] README が必要な場合は更新されている
```

### レビューチェックリスト（人間用）

```markdown
## Functional Correctness
- [ ] 要件通りに実装されている
- [ ] 想定されたユースケースをカバーしている

## Architecture Alignment
- [ ] プロジェクトのアーキテクチャに沿っている
- [ ] レイヤー分離が適切
- [ ] 関心の分離が適切

## Business Impact
- [ ] ビジネス価値が実現されている
- [ ] 他機能との競合がない

## Risk Assessment
- [ ] 本番環境への悪影響がない
- [ ] ロールバック戦略がある（必要な場合）
```

---

## ドキュメント作成ルール

### ドキュメント種別とテンプレート

| ドキュメント | 位置 | 更新頻度 | 責務 |
|---|---|---|---|
| README | リポジトリ直下 | Phase毎 | Claude |
| PROJECT_CHARTER | `/docs/` | 承認時のみ | Team |
| ARCHITECTURE | `/docs/` | Phase開始前 | Claude |
| PRD | `/docs/requirements/prd/` | Feature毎 | ChatGPT |
| API Spec | `/docs/technical/` | 実装時 | Claude |
| DB Design | `/docs/design/` | DB変更時 | Claude |
| Development Rules | `/docs/` | 必要時 | Team |

### Markdown 規約

#### ヘッダー階層
```markdown
# H1: ドキュメントのタイトル（1ドキュメント1つだけ）

## H2: セクション（大見出し）

### H3: サブセクション

#### H4: 詳細項目
```

#### リスト
```markdown
- 箇条書き項目1
  - ネストされた項目
  - ネストされた項目
- 箇条書き項目2

1. 番号付きリスト1
2. 番号付きリスト2
   1. ネストされた番号付き
```

#### コードブロック
```markdown
\`\`\`python
# Python コード例
def hello():
    print("Hello")
\`\`\`

\`\`\`typescript
// TypeScript コード例
const greet = (): string => "Hello";
\`\`\`

\`\`\`bash
# Bash コマンド例
python -m pytest tests/
\`\`\`
```

#### テーブル
```markdown
| 列1 | 列2 | 列3 |
|---|---|---|
| 値1 | 値2 | 値3 |
| 値4 | 値5 | 値6 |
```

### ドキュメント作成フロー

```
1. Issue で要件確認
2. Markdown ドラフト作成
3. GitHub で PR として提案
4. レビュー・フィードバック
5. Merge & Deploy
```

---

## GitHub Issue 管理

### Issue テンプレート

#### [Feature]
```markdown
## Description
[機能の説明]

## User Story
As a [ユーザータイプ]
I want to [したいこと]
So that [期待される結果]

## Acceptance Criteria
- [ ] 条件1
- [ ] 条件2

## Related PRD
[PRD ドキュメントリンク]

## Labels
- `feature`
- `phase1` / `phase2` / `phase3`
- `backend` / `frontend` / `ai`
```

#### [Design]
```markdown
## Design Task
[設計内容の説明]

## Scope
- [ ] ER図
- [ ] API仕様
- [ ] ワイヤーフレーム

## Related Documents
[参考資料リンク]

## Labels
- `design`
- `phase1` / `phase2` / `phase3`
```

#### [Bug]
```markdown
## Bug Description
[バグの説明]

## Steps to Reproduce
1. [ステップ1]
2. [ステップ2]

## Expected Behavior
[期待される挙動]

## Actual Behavior
[実際の挙動]

## Environment
- OS: [例: macOS 12.0]
- Browser: [例: Chrome 100]

## Labels
- `bug`
- `priority-high` / `priority-medium` / `priority-low`
```

#### [AI Task]
```markdown
## Task
[AI が担当するタスク]

## Input
[AI に提供するドキュメント・データ]

## Expected Output
[成果物の形式・要件]

## Assigned AI
- [ ] Claude (設計・実装)
- [ ] ChatGPT (要件・文案)
- [ ] Gemini (調査・分析)

## Labels
- `ai`
- `ai:claude` / `ai:gpt` / `ai:gemini`
```

### Label 管理

```
Category: phase1, phase2, phase3
Type: feature, bug, design, docs, ai, refactor
Priority: priority-high, priority-medium, priority-low
Status: needs-review, blocked, in-progress, needs-estimation
AI Role: ai:claude, ai:gpt, ai:gemini, ai:sakana
```

---

## デプロイメント

### デプロイメント環境

```
Staging (開発検証環境)
├─ develop ブランチから自動デプロイ
├─ 全テスト実行後にデプロイ
└─ 本番前の最終確認環境

Production (本番環境)
├─ release/* ブランチからデプロイ
├─ 手動承認 required
└─ ロールバック戦略を準備
```

### デプロイメント手順

```
1. release/vX.Y ブランチを作成
2. バージョン番号を更新
3. CHANGELOG を記述
4. PR to main
5. Code review + approval
6. Merge to main
7. GitHub Release を作成
8. CI/CD パイプラインが自動デプロイ
9. Smoke tests 実行
10. ロールアウト完了
```

### ロールバック手順

```
# 緊急の場合:
git revert <commit-hash>
git push origin main

# または:
git checkout <previous-tag>
# 新しいリリースを作成してデプロイ
```

---

## パフォーマンス・セキュリティチェックリスト

### デプロイ前チェックリスト

#### パフォーマンス
- [ ] API レスポンスタイム < 500ms (p95)
- [ ] フロントエンド Lighthouse スコア > 80
- [ ] DB クエリ最適化確認（EXPLAIN ANALYZE）
- [ ] 画像・静的資源は CDN にキャッシュ
- [ ] キャッシング戦略が実装されている

#### セキュリティ
- [ ] 入力値は全て検証・サニタイズ
- [ ] SQL インジェクション対策確認
- [ ] XSS 対策確認
- [ ] CSRF トークン実装
- [ ] 認証・認可がルートで確認される
- [ ] API レート制限が実装されている
- [ ] ロギングに PII が含まれていない
- [ ] 環境変数として秘密情報を管理
- [ ] HTTPS のみ使用
- [ ] Security Headers が設定されている

#### テスト
- [ ] ユニットテスト カバレッジ > 80%
- [ ] 統合テスト 成功
- [ ] E2E テスト 成功
- [ ] セキュリティ脆弱性スキャン 完了

---

**最終更新**: 2026-07-02
