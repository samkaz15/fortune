import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

/**
 * POST /api/billing/credit
 * 追加クレジット(300円で質問5回分)の単発決済Checkoutセッションを発行する。
 * 実際の残高加算は Stripe Webhook(checkout.session.completed)で行う
 * (クライアントからの成功コールバックだけを信用しない、決済の整合性を担保するため)。
 */
const CREDIT_PACK_PRICE_JPY = 300;
const CREDIT_PACK_AMOUNT = 5;

export async function POST() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  const stripe = getStripe();
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
    success_url: `${process.env.APP_URL}/plans/complete?type=credit`,
    cancel_url: `${process.env.APP_URL}/plans`,
    metadata: { userId, kind: "credit_pack", amount: String(CREDIT_PACK_AMOUNT) },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
