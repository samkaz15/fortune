# CL3: データレイヤー追加設計（要約）

## 利用回数カウンター（1日5回）

- 正：Redis (`src/lib/redis.ts` の `consumeDailyFreeQuota`)。`INCR` + `EXPIRE` によるアトミック処理。
- 副：`DailyUsage`（Postgres）。日次バッチでの整合性チェック・分析用に用意（現状バッチ未実装）。
- 現行仕様の理解：カテゴリ別ではなく質問単位で合算5回。カテゴリ別に変える場合は
  Redisキーに `category` を含める形に変更する（`src/lib/redis.ts` の `todayKey` を参照）。

## クレジット残高

- `CreditBalance`（残高）+ `CreditTransaction`（purchase/consume/refundの履歴）に分離。
- 消費は `prisma.$transaction` で残高更新とトランザクション記録をアトミックに行う（`/api/chat`参照）。

## オークション入札の整合性制御

- `AuctionTicket.version` による楽観ロック。入札APIは `updateMany({ where: { id, version } })` の
  影響行数が0なら競合とみなし、`409 BID_CONFLICT` を返す（`/api/billing/auction/bid`参照）。
- リアルタイム性はコスト優先でポーリング方式（フロントは5秒間隔）を採用。
  WebSocket級のリアルタイム性が必要になった場合はPhase3で再検討する。

## PII隔離

- `User`（認証情報）と `UserProfile`（氏名・生年月日・性別・出生時間などのPII）を1:1で分離。
- 占術エンジン・要件が必要とするテーブル以外からは `UserProfile` を直接JOINしない運用を推奨
  （Repositoryパターンの徹底はPhase2以降、DIコンテナ導入時に強化）。

## 天気連携

- Redisで3時間キャッシュ（`src/lib/weather.ts`）。取得失敗時も占い本体を止めない設計。
