import Stripe from "stripe";

/**
 * 決済代行はStripeを想定(データレイヤー設計書⑦の方針通り、
 * カード番号等は自社DBに一切保持せずStripe側に委譲する)。
 * STRIPE_SECRET_KEY 未設定時はビルド・開発を止めないよう遅延初期化する。
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set. .env.local を設定してください。");
    }
    _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  }
  return _stripe;
}
