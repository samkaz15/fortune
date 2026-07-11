import type { Metadata } from "next";
import WorkPageClient from "./WorkPageClient";

/**
 * SEO基盤(2026-07-07・Marketing-029): 個別metadata。
 * 中身はWorkPageClient(クライアントコンポーネント)に分離。
 */
export const metadata: Metadata = {
  title: "仕事・キャリア診断 | 算命学ベースの適職診断",
  description: "生年月日から、あなたの働き方の本質・向いている業界と部署をAIが診断。算命学の考え方をベースにした無料のキャリア診断です。",
  alternates: { canonical: "/work" },
  openGraph: {
    title: "仕事・キャリア診断 | 錦糸町の少年",
    description: "生年月日から、あなたの適職を無料診断。",
    url: "/work",
  },
};

export default function WorkPage() {
  return <WorkPageClient />;
}
