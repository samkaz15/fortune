import type { Metadata } from "next";
import PlansPageClient from "./PlansPageClient";

/**
 * SEO基盤(2026-07-07・Marketing-029): 個別metadata。
 * 中身はPlansPageClient(クライアントコンポーネント)に分離。
 */
export const metadata: Metadata = {
  title: "プラン・お支払い | 月額980円で毎日の運勢を",
  description: "糸町の少年のサブスクプラン・追加クレジットのご案内。初月500円でチャット占い相談が使い放題。",
  alternates: { canonical: "/plans" },
  openGraph: {
    title: "プラン・お支払い | 糸町の少年",
    description: "月額980円で毎日の運勢を。",
    url: "/plans",
  },
};

export default function PlansPage() {
  return <PlansPageClient />;
}
