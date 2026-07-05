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
  | "quota_exhausted";

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
