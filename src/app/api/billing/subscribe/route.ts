import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/billing/subscribe { from?: string }
 * 月額サブスク登録(初月500円→2ヶ月目以降980円)のCheckoutセッションを発行する。
 *
 * 課金導線改善(2026-07-07・Marketing-006): `from`(元の診断ページ等)を受け取り、
 * 決済完了後にそのページへ戻れるようにする。決済のためにログイン先の文脈を
 * 失わせない設計(IA分析で最重要CVR改善案として指摘されていたもの)。
 *
 * Stripe側の設定が必要な事項(実装だけでは完結しない、運用開始前にStripeダッシュボードで設定):
 * - 通常価格(980円/月)のPriceを作成し、STRIPE_SUBSCRIPTION_PRICE_ID に設定する
 * - 初月500円は「初回のみ適用されるCoupon」または「Subscription Schedule」で表現する
 *   (このAPIでは coupon: STRIPE_FIRST_MONTH_COUPON_ID を適用する形にしている)
 */
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

  // 戻り先ページ(自分のこと/love/work等)。外部URLへのオープンリダイレクトを防ぐため
  // 相対パス("/"始まり)のみ許可する
  let from = "";
  try {
    const body = await req.json();
    if (typeof body?.from === "string" && body.from.startsWith("/")) from = body.from;
  } catch {
    /* bodyなしのリクエストも許容(後方互換) */
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing?.status === "active") {
    return NextResponse.json({ error: "ALREADY_SUBSCRIBED" }, { status: 409 });
  }

  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  const firstMonthCouponId = process.env.STRIPE_FIRST_MONTH_COUPON_ID;
  if (!priceId) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 500 });
  }

  const stripe = getStripe();
  let stripeCustomerId = existing?.stripeCustomerId ?? undefined;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId } });
    stripeCustomerId = customer.id;
  }

  const successUrl = from
    ? `${process.env.APP_URL}/plans/complete?type=subscribe&from=${encodeURIComponent(from)}`
    : `${process.env.APP_URL}/plans/complete?type=subscribe`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    discounts: firstMonthCouponId ? [{ coupon: firstMonthCouponId }] : undefined,
    success_url: successUrl,
    cancel_url: from ? `${process.env.APP_URL}${from}` : `${process.env.APP_URL}/plans`,
    metadata: { userId },
  });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: "inactive", stripeCustomerId },
    update: { stripeCustomerId },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
