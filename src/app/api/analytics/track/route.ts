/**
 * POST /api/analytics/track { name, props? }
 * クライアント側(React/LP静的HTML)から計測イベントを送信する汎用エンドポイント。
 * (計測基盤 2026-07-07・Marketing-083)
 *
 * サーバー側で完結するイベント(会員登録完了・課金完了・サブスク開始等)は
 * 各APIルートから直接 lib/analytics.ts の trackEvent() を呼ぶため、このAPIは不要。
 * このAPIは「ユーザーの画面操作」起点のイベント(LP表示・診断開始・シェア押下等)専用。
 *
 * 認証不要(未ログインのLP表示等も計測するため)。ログイン中はuserIdも記録する。
 * fire-and-forgetの思想を踏襲し、失敗してもユーザー体験に影響させない(常に200を返す)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, type AnalyticsEventName } from "@/lib/analytics";
import { getCurrentUserId } from "@/lib/auth";

// クライアントから送信可能なイベント名を限定(サーバー完結イベントは含めない誤送信防止)
const CLIENT_EVENT_NAMES = [
  "lp_view",
  "signup_started",
  "free_reading_started",
  "free_reading_completed",
  "upsell_shown",
  "checkout_started",
  "share",
] as const satisfies readonly AnalyticsEventName[];

const schema = z.object({
  name: z.enum(CLIENT_EVENT_NAMES),
  props: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
    const userId = await getCurrentUserId().catch(() => null);
    trackEvent(parsed.data.name, parsed.data.props, userId ?? undefined);
  } catch {
    // fire-and-forget: 計測失敗でユーザー体験を止めない
  }
  return NextResponse.json({ ok: true });
}
