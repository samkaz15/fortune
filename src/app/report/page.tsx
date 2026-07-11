import type { Metadata } from "next";
import ReportPageClient from "./ReportPageClient";

/**
 * SEO基盤(2026-07-07・Marketing-029): 個別metadata。
 * 中身はReportPageClient(クライアントコンポーネント)に分離。
 */
export const metadata: Metadata = {
  title: "今日の運勢 | 毎日の意思決定レポート",
  description: "四柱推命ベースのスコアリングで、今日・今週・今月・来月の運勢と行動指針をお届け。",
  alternates: { canonical: "/report" },
  openGraph: {
    title: "今日の運勢 | 錦糸町の少年",
    description: "今日・今週・今月・来月の運勢をチェック。",
    url: "/report",
  },
};

export default function ReportPage() {
  return <ReportPageClient />;
}
