import type { Metadata } from "next";
import SelfPageClient from "./SelfPageClient";

/**
 * SEO基盤(2026-07-07・Marketing-016,018,029,030): 個別metadata+JSON-LD(WebApplication)。
 * 中身はSelfPageClient(クライアントコンポーネント)に分離してある(Next.js App Routerの
 * 制約上、"use client"コンポーネントはmetadataをexportできないため)。
 */
export const metadata: Metadata = {
  title: "自分のこと診断 | 四柱推命ベースの無料性格診断",
  description:
    "生年月日から、あなたの本質・行動特性・今日の行動指針をAIが診断。四柱推命の考え方をベースにした無料の自己分析診断です。",
  alternates: { canonical: "/self" },
  openGraph: {
    title: "自分のこと診断 | 糸町の少年",
    description: "生年月日から、あなたの本質を無料診断。",
    url: "/self",
  },
};

export default function SelfPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "自分のこと診断",
            applicationCategory: "LifestyleApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
          }),
        }}
      />
      <SelfPageClient />
    </>
  );
}
