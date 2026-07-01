# Product Requirements Document (PRD) Template

## PRD 標準テンプレート

すべての機能開発は以下のテンプレートに従う PRD を作成してください。

---

## [Feature Name]

### Executive Summary
**[1段落で機能の概要を説明]**

- 何か: [機能の簡潔な説明]
- なぜ: [ユーザーニーズ・ビジネスインパクト]
- 期待される効果: [定量目標]

### Background & Motivation

#### ユーザーニーズ
- ペルソナ: [対象ユーザー]
- 痛点: [解決する課題]
- ユースケース: [具体的な使用シーン]

#### ビジネスインパクト
- 差別化ポイント: [競合との違い]
- 収益への寄与: [課金・継続率への影響]
- KPI への寄与: [目標数値]

### Goals & Success Metrics

#### 定性目標
- [ ] ユーザーが簡単に使える
- [ ] ブランド世界観に合致している
- [ ] 占術精度が高い

#### 定量目標（KPI）
- 継続率: [目標値]
- 課金導入率: [目標値]
- 平均セッション時間: [目標値]

#### 検証方法
- β版テストでの定性フィードバック
- A/Bテストによる効果測定
- ユーザー行動ログ分析

### Scope

#### MVP（Phase1）スコープ
- [ ] [機能1]
- [ ] [機能2]

#### Phase2 で追加
- [ ] [機能3]

#### Phase3 で追加
- [ ] [機能4]

#### スコープ外
- [ ] [実装しない機能]

### User Stories & Use Cases

#### ペルソナ別シナリオ

**ペルソナ: [名前・属性]**
```
As a [ユーザー]
I want to [したいこと]
So that [期待される結果]
```

**Happy Path:**
1. [ステップ1]
2. [ステップ2]
3. [成功状態]

**Sad Path (エラーハンドリング):**
- ネットワークエラー → [回復方法]
- 入力エラー → [ガイダンス]

### Functional Requirements

#### 画面フロー
```
[ワイヤーフレーム参照 or テキスト記述]
画面A → 画面B → 画面C
```

#### API 仕様（簡易版）

**リクエスト:**
```json
POST /api/v1/feature
{
  "param1": "value1",
  "param2": "value2"
}
```

**レスポンス:**
```json
{
  "id": "uuid",
  "result": {...},
  "createdAt": "2026-07-02T00:00:00Z"
}
```

詳細は `/docs/technical/api_spec.yaml` を参照。

#### データモデル（簡易版）
```sql
-- 主要テーブル
CREATE TABLE [feature_table] (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP,
  ...
);
```

詳細は `/docs/design/db_design.md` を参照。

### Non-Functional Requirements

#### パフォーマンス要件
- API レスポンスタイム: < 500ms (p95)
- DB クエリ実行時間: < 100ms (p95)
- 同時接続数: [目標値]

#### セキュリティ要件
- 認証: JWT Token + Refresh Token
- 個人情報暗号化: AES-256
- PCI DSSコンプライアンス: [必要/不要]

#### スケーラビリティ要件
- 数百万ユーザーに対応
- DB 水平分割対応可能な設計
- CDN キャッシュ対応

### Design & UX Considerations

#### デザインコンセプト
- ブランド色: [説明]
- トーン: [説明]
- 参考デザイン: [URL or 説明]

#### ワイヤーフレーム
[Figma URL or `/docs/design/wireframes/` を参照]

#### アクセシビリティ
- WCAG 2.1 Level AA 対応
- キーボード操作対応
- スクリーンリーダー対応

### Technical Approach

#### 推奨技術スタック
- **Backend**: FastAPI + SQLAlchemy
- **Frontend**: Next.js + React
- **DB**: PostgreSQL

#### インテグレーション
- OpenAI API（チャット機能の場合）
- Sakana AI API（推薦機能の場合）
- 既存テーブル: [依存するテーブル]

#### マイグレーション戦略（既存機能との連携時）
```
Phase: [フェーズ]
旧機能の継続: [期間]
並行運用: [期間]
切り替え: [日時]
```

### AI占いサービス固有の要件

#### 占術仕様（占い機能の場合）
- **対象占術**: [四柱推命/算命学/姓名判断]
- **入力パラメータ**: [生年月日など]
- **出力フォーマット**: [結果形式の説明]
- **精度要件**: [具体的な精度目標]

**サンプル出力:**
```json
{
  "fortuneType": "DAILY",
  "score": 85,
  "description": "...",
  "recommendation": "..."
}
```

#### AIチャット仕様（チャット機能の場合）
- **プロンプト設計**: `/prompts/chat/[feature].md` を参照
- **コンテキスト保持**: [方法]
- **応答タイムアウト**: 30秒
- **トーン**: [指定](例: 励ましと共感重視)

#### 課金・LTV 要件（課金機能の場合）
- **課金モデル**: [サブスク/クレジット/オークション]
- **価格設定**: [根拠]
- **チャーン率目標**: < 5% / 月
- **LTV/CAC比**: > 3

#### 通知戦略（通知機能の場合）
- **通知タイプ**: [運気通知/95点通知など]
- **発火条件**: [ルール]
- **時間帯**: [スケジュール]
- **オプトアウト**: [ユーザー選択可能]

### Risks & Mitigation

| リスク | 確率 | 影響 | 対策 |
|---|---|---|---|
| [リスク説明] | High/Mid/Low | High/Mid/Low | [対策] |

### Dependencies & Blockers

- [ ] [依存タスク]: [WBS番号]
- [ ] [ブロッカー]: [説明]

### Timeline

- **設計**: [開始日] - [終了日] ([X営業日])
- **実装**: [開始日] - [終了日] ([X営業日])
- **テスト**: [開始日] - [終了日] ([X営業日])
- **Phase**: [属するPhase]

### Appendix

#### 参考資料
- 競合分析: `/docs/design/competitive_analysis/`
- 類似機能: [既存システムの参考例]

#### 用語集
| 用語 | 説明 |
|---|---|
| [用語1] | [説明] |

#### 詳細設計参照
- API仕様: `/docs/technical/api_spec.yaml` のエンドポイント [X]
- DB設計: `/docs/design/db_design.md` のテーブル [Y]
- UI設計: `/docs/design/wireframes/[feature]/`

---

## fortuneプロダクト固有の PRD ガイドライン

### 占い機能 PRD の追加要素

**プロンプト例:**
```
ユーザーの生年月日・名前から、四柱推命・算命学・姓名判断を統合し、
以下の形式で結果を生成してください:

{
  "fortune": {
    "lucky_number": ...,
    "lucky_color": ...,
    "lucky_action": "...",
    "character_trait": "..."
  }
}
```

### チャット機能 PRD の追加要素

**トーン定義:**
```
- 励ましと共感を重視
- 決定権はユーザーに委ねる
- 具体的で実行可能なアドバイス
```

### 決済機能 PRD の追加要素

**オークション仕様:**
```
- 24時間制オークション
- 開始時刻: 毎日 21:00 JST
- 出品者: CEO のみ（初期段階）
- 対象: 個人面談占いチケット
```

---

## PRD 作成プロセス

### 1. Issue Template での初期化
GitHub Issue を [PRD] ラベルで開く → テンプレート自動入力

### 2. AIによる初期ドラフト作成
```bash
# Claude Code で以下を実行:
# - 競合分析データを読み込み
# - 要件を PRD フォーマットで整理
```

### 3. レビュー・承認
- [ ] OpenAI による文案・構造レビュー
- [ ] Claude による技術仕様の妥当性確認
- [ ] CEO による占術仕様の承認

### 4. GitHub に commit
```
docs/requirements/prd/[feature_name].md
```

---

## 現在のフェーズ別 PRD

### Phase 1 (MVP)
- `/docs/requirements/prd/phase1_mvp.md`

### Phase 2 (拡張)
- `/docs/requirements/prd/phase2_expansion.md`

### Phase 3 (スケール化)
- `/docs/requirements/prd/phase3_scale.md`

---

**最終更新**: 2026-07-02
