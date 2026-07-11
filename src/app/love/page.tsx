import type { Metadata } from "next";
import LovePageClient from "./LovePageClient";

/**
 * SEO基盤(2026-07-07・Marketing-029): 個別metadata。
 * 中身はLovePageClient(クライアントコンポーネント)に分離。
 */
export const metadata: Metadata = {
  title: "恋愛・相性診断 | 姓名判断で見るふたりの相性",
  description: "ふたりの名前から、相性・心の距離・進展のタイミングをAIが診断。姓名判断の考え方をベースにした無料の恋愛相性診断です。",
  alternates: { canonical: "/love" },
  openGraph: {
    title: "恋愛・相性診断 | 錦糸町の少年",
    description: "ふたりの名前から、相性を無料診断。",
    url: "/love",
  },
};

export default function LovePage() {
  return <LovePageClient />;
}
