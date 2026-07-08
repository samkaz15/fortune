# CL2: 画面遷移設計書改訂版（要約）

## 主要フロー（実装対応）

```
TOP(/)
 └ 「今日の占いを見る」→ /consult?category=TODAY
 └ 相談カテゴリカード → /consult?category=RELATIONSHIP|SELF|BUSINESS|COMPATIBILITY
 └ 「オークションを見る」→ /auction

/consult
 └ category未指定 → カテゴリ選択カード表示（ChatWindow.tsx内で分岐）
 └ チャット送信 → POST /api/chat
     ├─ 401 → ログイン誘導CTA(/auth/login)
     ├─ 409 PROFILE_REQUIRED → 新規登録誘導CTA(/auth/signup)
     ├─ 402 QUOTA_EXCEEDED → 課金誘導CTA(/plans)
     └─ 200 → /result/:id へ自動遷移(1.2秒後)

/result/:id
 └ isUnlocked=false → ロック表示 + 「続きを見る」→ /plans
 └ isUnlocked=true  → 全文表示 + シェアボタン(Web Share API)

/plans（タブ: サブスク / 追加クレジット）
 └ 「このプランで始める」/「クレジットを追加する」→ Stripe Checkoutへリダイレクト
 └ 決済成功 → /plans/complete → 1.8秒後 /mypage へ自動遷移

/auction
 └ 5秒間隔ポーリングで一覧更新(リアルタイム性はコスト優先でポーリング方式に決定済み)
 └ 入札 → POST /api/billing/auction/bid（楽観ロックで競合を検知、409で最新価格を返す）

/mypage
 └ 残り回数・クレジット残高・契約状況・直近5件の診断履歴を1画面に集約
 └ 「退会手続き」→ /mypage/account/cancel（休会提案 → 最終確認の2ステップ）
```

## 遷移ルールの実装対応

- 戻る：`Header.tsx` が全画面共通で `router.back()` を提供（TOPのみロゴ表示）。
- モーダルは今回未実装（退会確認は別画面のステップ切り替えで代替。将来ダイアログ化してもよい）。
- 二重生成防止：`acquireGenerationLock`(Redis) により、チャット送信の連打でSakana AIへの
  二重リクエストが飛ばないようにしている。
