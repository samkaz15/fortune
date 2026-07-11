# 意思決定レポート プロダクション設計書

**対象**: 「今日の意思決定レポート」機能（CEO_UPDATE_decision_report_spec.md 準拠）
**目的**: AI生成品質を一定に保ち、機能追加時にも設計がぶれない基盤を定義する
**作成日**: 2026-07-03

---

## 1. 全体アーキテクチャ

```
ユーザー情報(UserProfile)
        ↓
┌──────────────────────────────────┐
│ ① 占術シグナル抽出層（決定論的・LLM不使用）│
│  四柱推命 → timing(運気の波/タイミング)     │
│  算命学   → business(仕事/才能)            │
│  ホロスコープ → psychology(心理/感情)       │
│  姓名判断 → relationship(人間関係/社会運)   │
└──────────────────┬───────────────┘
                    ↓ DivinationFeatures(構造化JSON)
┌──────────────────────────────────┐
│ ② 外部環境分析層（決定論的）              │
│  天気API → 人間行動キーワードへの翻訳表     │
└──────────────────┬───────────────┘
                    ↓ EnvironmentFeatures
┌──────────────────────────────────┐
│ ③ RAG検索層                            │
│  過去セッションの構造化サマリ(KnowledgeEntry)│
│  からユーザーの現在テーマを抽出             │
└──────────────────┬───────────────┘
                    ↓ UserThemeFeatures
┌──────────────────────────────────┐
│ ④ ルールベーススコアリング層（LLM不使用）   │
│  score = f(占術, 外部環境, ユーザー状態)    │
│  → 100点満点 + ★5段階（AIは点数を変えない）│
└──────────────────┬───────────────┘
                    ↓ ScoreBreakdown
┌──────────────────────────────────┐
│ ⑤ LLM統合推論層（Sakana AI）             │
│  入力: 上記すべての構造化データ            │
│  出力: 固定スキーマJSON（6項目レポート）    │
│  役割: 統合・矛盾整理・パーソナライズ・文章化│
└──────────────────┬───────────────┘
                    ↓
        今日の意思決定レポート(DailyReport)
```

**層分離の原則**: ①〜④は決定論的（同じ入力なら同じ出力）でユニットテスト可能にする。
LLMの非決定性を⑤に閉じ込めることで、品質問題の切り分けが常に可能になる。

---

## 2. スコアリング設計（ルールベース）

AIは点数を決めない。以下の加重合成で決定論的に算出する。

```
baseScore   = shichu.wave                    # 四柱推命の運気の波(20-100)
envModifier = Σ 環境要因の補正値               # -10〜+5
themeBonus  = ユーザーテーマと運勢キーワードの
              一致時 +5（「挑戦」テーマの日に
              「決断」キーワードが出た等）
score = clamp(baseScore + envModifier + themeBonus, 5, 100)
stars = ceil(score / 20)                      # ★1〜5
```

### 環境補正テーブル（envModifier）

| 条件 | 補正 | 翻訳キーワード候補 |
|---|---|---|
| 低気圧(<1005hPa) | -8 | 疲労 / 判断を急ぎやすい空気 / 周囲も余裕がなくなりやすい |
| やや低気圧(1005-1010) | -4 | 集中力のムラ / 焦り |
| 標準(1010-1020) | 0 | 平常運転 / 落ち着き |
| 高気圧(>1020) | +5 | 頭が冴える / 行動しやすい空気 |
| 月曜日 | -2 | 週初めの慌ただしさ / 情報過多 |
| 金曜日 | +2 | 開放感 / 週の締めくくり |

**禁止事項**: 気象用語（低気圧・hPa等）をユーザー向けテキストに出力しない。
翻訳キーワードのみをLLMに渡す（LLMは気圧の生値を受け取らない設計にすることで、
「今日は低気圧なので」という表現をシステム的に不可能にする）。

---

## 3. RAG設計

### 知識ベースの構造（KnowledgeEntry）

会話ログの生テキストは使わない。セッション完了時に以下へ構造化して保存する:

```json
{
  "userId": "...",
  "sessionId": "...",
  "category": "BUSINESS",
  "userConcern": "転職すべきか迷っている",       // ユーザーの悩み(1文要約)
  "divinationSummary": "行動に適した時期",       // 占術結果の要点
  "finalAdvice": "情報収集から始める",           // 最終アドバイスの要点
  "nextAction": "求人サイトに登録する",
  "tags": ["転職", "挑戦", "キャリア"],
  "createdAt": "..."
}
```

### 検索方式（Phase2実装）

- **キーワード集計方式**: 直近30日のKnowledgeEntryのtagsを頻度集計し、
  最頻出タグ上位を「ユーザーが今向き合っているテーマ」として抽出
- ベクトル検索（pgvector）はPhase3で導入。KnowledgeEntryの構造は
  embedding列を後付けできる形にしておく（スキーマに影響しない拡張）

### 構造化の生成タイミング

セッション完了時（FortuneResult保存直後）に非同期で生成。
Phase2ではLLM呼び出しを節約するため、userConcern=ユーザーの最初のメッセージ(120字まで)、
tags=カテゴリ+運勢キーワードのルールベース抽出とし、LLMによる高品質要約はPhase3で導入。

---

## 4. システムプロンプト設計

### 品質を一定に保つ3層構造

```
Layer1: キャラクター人格（system_prompt.v2.0.md / 錦糸町の少年・不変）
Layer2: タスク定義（decision_report_task.v1.0.md / 本機能専用・出力スキーマ厳守）
Layer3: 実行時コンテキスト（構造化JSONデータ / 毎回変わる）
```

### Layer2の必須要素（prompts/chat/decision_report_task.v1.0.md として管理）

1. 出力は固定JSONスキーマのみ（6項目）。スキーマ外のテキスト禁止
2. スコア・キーワードは入力値をそのまま使う（変更・再計算禁止）
3. 総合要約は150〜250字、注意ポイントは必ず3項目、やるべき行動は必ず1つ
4. 気象用語の使用禁止（翻訳キーワードのみ使用）
5. CEO_STRAT準拠: 常にポジティブ・決め打ち、ネガティブなタイミング表現禁止
6. 占術名を根拠として明示しない（「錦糸町の少年スタイル」原則の維持）

### 出力スキーマ（JSON、バリデーションはZodで強制）

```json
{
  "keywords": { "userTheme": "挑戦", "environment": "焦り", "fortune": "準備" },
  "summary": "150-250字の行動方針",
  "cautions": ["衝動買い", "感情的な返信", "即決"],
  "advice": "統合アドバイス本文",
  "todayAction": "今日やるべき1つの行動"
}
```

パース失敗・字数違反・項目数違反時は1回だけ再生成し、それでも失敗ならルールベースの
フォールバックレポート（テンプレート文）を返す。**ユーザーにエラーを見せない**。

---

## 5. データベース設計（追加分）

```prisma
model DailyReport {
  id            String   @id @default(uuid())
  userId        String
  reportDate    DateTime @db.Date           // 1ユーザー1日1件
  score         Int                          // ルールベース算出(不変)
  stars         Int
  keywords      Json     // {userTheme, environment, fortune}
  summary       String
  cautions      Json     // [string, string, string]
  advice        String
  todayAction   String
  scoreBreakdown Json    // {base, envModifier, themeBonus} 監査・改善用
  generatedBy   String   @default("llm")     // llm | fallback
  createdAt     DateTime @default(now())
  @@unique([userId, reportDate])
}

model KnowledgeEntry {
  id                 String   @id @default(uuid())
  userId             String
  sessionId          String   @unique
  category           ConsultCategory
  userConcern        String
  divinationSummary  String
  finalAdvice        String
  nextAction         String
  tags               Json     // string[]
  createdAt          DateTime @default(now())
  @@index([userId, createdAt])
}
```

- DailyReportは`@@unique([userId, reportDate])`により再生成を防ぐ（同日2回目のアクセスはキャッシュ返却）
- scoreBreakdownを保存することで「なぜこの点数か」を後から監査でき、スコアリングルールの改善に使える

---

## 6. API構成

```
GET  /api/report/today        今日のレポート取得（無ければ生成）。日次1回生成・以降はDB返却
                              → 1日5回の質問クォータは消費しない（毎日開く動機の中核機能のため無料）
POST /api/report/regenerate   （Phase3候補）有料での再生成。当面は提供しない
既存 /api/chat                 個別相談。セッション完了時にKnowledgeEntryを自動生成するよう拡張
```

### /api/report/today のフロー

```
認証 → 当日分DailyReport存在チェック（あれば即返却）
  → 占術4種計算(決定論) → 環境分析(決定論) → RAGテーマ抽出(決定論)
  → ルールベーススコアリング → LLM統合推論(Sakana AI/モック)
  → Zodバリデーション → 失敗時1リトライ → フォールバック
  → DailyReport保存 → 返却
```

---

## 7. 拡張性の担保

| 将来の拡張 | 現設計での受け皿 |
|---|---|
| ベクトルRAG(pgvector) | KnowledgeEntryにembedding列を追加するだけ。検索関数のインターフェースは変えない |
| スコアリングルールの改善 | scoreBreakdown監査データを基にテーブル値を調整。コード構造は不変 |
| 新しい占術の追加 | DivinationFeaturesにキーを1つ追加。役割表(担当領域)に1行追加 |
| レポートのA/Bテスト | DailyReport.generatedByにバリアント識別子を記録できる |
| 通知連携 | 既存の/api/notifications/evaluateがDailyReport.scoreを参照する形に統合可能 |
