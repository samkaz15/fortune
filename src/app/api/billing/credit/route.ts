import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

/**
 * POST /api/billing/credit { from?: string }
 * 追加クレジット(300円で質問5回分)の単発決済Checkoutセッションを発行する。
 * 実際の残高加算は Stripe Webhook(checkout.session.completed)で行う
 * (クライアントからの成功コールバックだけを信用しない、決済の整合性を担保するため)。
 *
 * 課金導線改善(2026-07-07・Marketing-006): fromがあれば決済完了後に元ページへ復帰させる
 * (subscribe APIと同じ設計、詳細はそちらのコメント参照)。
 */
const CREDIT_PACK_PRICE_JPY = 300;
const CREDIT_PACK_AMOUNT = 5;

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  let from = "";
  try {
    const body = await req.json();
    if (typeof body?.from === "string" && body.from.startsWith("/")) from = body.from;
  } catch {
    /* bodyなしのリクエストも許容(後方互換) */
  }

  const stripe = getStripe();
  const successUrl = from
    ? `${process.env.APP_URL}/plans/complete?type=credit&from=${encodeURIComponent(from)}`
    : `${process.env.APP_URL}/plans/complete?type=credit`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "jpy",
          unit_amount: CREDIT_PACK_PRICE_JPY,
          product_data: { name: `質問追加クレジット(${CREDIT_PACK_AMOUNT}回分)` },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: from ? `${process.env.APP_URL}${from}` : `${process.env.APP_URL}/plans`,
    metadata: { userId, kind: "credit_pack", amount: String(CREDIT_PACK_AMOUNT) },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
