/**
 * CL25: 分析イベント記録(DWH基盤の入口)
 *
 * GM10調査「生成コストはサーバー数ではなくトークン数で管理する」に基づき、
 * LLM呼び出し系イベントには props.tokens を必ず載せる運用とする。
 * 記録はfire-and-forget(本処理をブロックしない・失敗しても本処理は成功させる)。
 *
 * 集計はDB側の dwh_daily_summary ビュー(prisma/manual_phase3.sql)と
 * /api/admin/analytics (CL28) が担う。
 */
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";

export type AnalyticsEventName =
  | "chat_message"
  | "report_generated"
  | "payment_succeeded"
  | "subscription_started"
  | "experiment_exposure"
  | "signup"
  | "quota_exhausted"
  // 計測基盤拡張(2026-07-07 マーケティング施策Marketing-083): CEO指定18イベントの残り14種
  | "lp_view" // LP表示
  | "signup_started" // 会員登録開始(フォーム到達)
  | "free_reading_started" // 無料占い開始(self/love/work/report診断開始)
  | "free_reading_completed" // 無料占い完了(結果表示)
  | "upsell_shown" // 有料誘導表示(モザイクCTA表示)
  | "checkout_started" // 課金開始(Stripe Checkoutへ遷移)
  | "subscription_canceled" // 解約
  | "share" // シェア(SNS共有ボタン押下)
  | "referral_signup"; // 紹介経由の登録

export function trackEvent(
  name: AnalyticsEventName,
  props?: Record<string, unknown>,
  userId?: string
): void {
  // fire-and-forget: awaitしない。失敗はログのみ(本処理へ影響させない)
  prisma.analyticsEvent
    .create({
      data: {
        id: randomUUID(),
        userId: userId ?? null,
        name,
        props: props ? JSON.parse(JSON.stringify(props)) : undefined,
      },
    })
    .catch((e: unknown) => {
      console.error("[analytics] track failed:", name, e instanceof Error ? e.message : e);
    });
}
