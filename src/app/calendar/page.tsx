import type { Metadata } from "next";
import CalendarPageClient from "./CalendarPageClient";

/**
 * SEO基盤(2026-07-07・Marketing-029): 個別metadata。
 * 中身はCalendarPageClient(クライアントコンポーネント)に分離。
 */
export const metadata: Metadata = {
  title: "風水カレンダー | あなたの開運日・注意日",
  description: "四柱推命×暦注(六曜等)で、あなた専用の開運日・注意日をカレンダー表示。",
  alternates: { canonical: "/calendar" },
  openGraph: {
    title: "風水カレンダー | 錦糸町の少年",
    description: "あなたの開運日・注意日をチェック。",
    url: "/calendar",
  },
};

export default function CalendarPage() {
  return <CalendarPageClient />;
}
