import type { Metadata } from "next";
import ShrinesPageClient from "./ShrinesPageClient";

/**
 * SEO基盤(2026-07-07・Marketing-029): 個別metadata。
 * 中身はShrinesPageClient(クライアントコンポーネント)に分離。
 */
export const metadata: Metadata = {
  title: "縁のある神社 | あなたの運気に合う参拝先",
  description: "今日の運気に合わせた、おすすめの神社・パワースポットを紹介。参拝の作法やレビューも掲載。",
  alternates: { canonical: "/shrines" },
  openGraph: {
    title: "縁のある神社 | 錦糸町の少年",
    description: "あなたの運気に合う神社を探す。",
    url: "/shrines",
  },
};

export default function ShrinesPage() {
  return <ShrinesPageClient />;
}
