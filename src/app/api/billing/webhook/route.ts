import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

/**
 * POST /api/billing/webhook
 *
 * Stripeからの決済確定通知を受け取り、DBへ反映する。
 * クライアント側の「成功しました」コールバックだけを信用せず、
 * 必ずここ(サーバー間通信)を正としてクレジット加算・サブスク有効化を行う
 * (データレイヤー設計書⑨「決済操作は改ざん耐性のある経路で確定させる」方針に対応)。
 *
 * 前提として、Stripeダッシュボードでこのエンドポイントを
 * Webhook宛先として登録し、STRIPE_WEBHOOK_SECRET を .env に設定すること。
 * 対象イベント: checkout.session.completed / customer.subscription.updated /
 *              customer.subscription.deleted
 *
 * Next.js App RouterのRoute Handlerはデフォルトでbodyをパースしないため、
 * 署名検証に必要な生のリクエストボディがそのまま渡ってくる。
 * （bodyParserの無効化設定は不要。pages routerとの違いに注意）
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 500 });
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: "INVALID_SIGNATURE", detail: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionSync(event.data.object as Stripe.Subscription);
        break;
      default:
        // 未ハンドルのイベントは無視してよい(Stripe側は2xxを受け取れば再送しない)
        break;
    }
  } catch (err) {
    // ここで例外を投げるとStripeが自動リトライしてくれるので、
    // 一時的なDB障害等はログを残した上で500を返すのが正しい。
    console.error("[stripe webhook] handling failed", event.type, err);
    return NextResponse.json({ error: "WEBHOOK_HANDLER_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.warn("[stripe webhook] checkout.session.completed without userId metadata", session.id);
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    const stripe = getStripe();
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status: "active",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      update: {
        status: "active",
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: null,
      },
    });
    trackEvent("subscription_started", {}, userId);
    return;
  }

  // トークション落札決済(仕様書§決済: 決済成功→即時ステータス反映→予約へ)
  if (session.mode === "payment" && session.metadata?.kind === "auction_win") {
    const ticketId = session.metadata?.ticketId;
    if (ticketId) {
      await prisma.auctionTicket.updateMany({
        where: { id: ticketId, winnerUserId: userId, status: { in: ["awaiting_payment", "pending_bank"] } },
        data: { status: "paid" },
      });
      await prisma.auditLog.create({
        data: { actorType: "system", action: "auction_paid", targetType: "auction_ticket", targetId: ticketId, metadata: { userId, sessionId: session.id } },
      });
      trackEvent("payment_succeeded", { kind: "auction_win" }, userId);
    }
    return;
  }

  if (session.mode === "payment" && session.metadata?.kind === "credit_pack") {
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

    // 冪等性の担保：同じpaymentIntentIdの加算処理が既に記録されていればスキップする
    // (Stripeは同一イベントを複数回配信することがあるため)
    if (paymentIntentId) {
      const already = await prisma.creditTransaction.findFirst({
        where: { stripePaymentId: paymentIntentId, type: "purchase" },
      });
      if (already) return;
    }

    const amount = Number(session.metadata?.amount ?? 5);
    const priceJpy = session.amount_total ?? 300;

    await prisma.$transaction([
      prisma.creditBalance.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          type: "purchase",
          amount,
          priceJpy,
          stripePaymentId: paymentIntentId,
        },
      }),
    ]);
    trackEvent("payment_succeeded", { kind: "credit" }, userId);
  }
}

async function handleSubscriptionSync(subscription: Stripe.Subscription) {
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) {
    console.warn("[stripe webhook] subscription sync: no matching local record", subscription.id);
    return;
  }

  const status = mapStripeStatus(subscription.status);
  await prisma.subscription.update({
    where: { userId: existing.userId },
    data: {
      status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
  });
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "past_due":
      return "paused";
    default:
      return "inactive";
  }
}
