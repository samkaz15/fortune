import type { Metadata, Viewport } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";

const shippori = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["500", "600", "800"],
  variable: "--font-shippori",
  display: "swap",
});

const zenkaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zenkaku",
  display: "swap",
});

export const metadata: Metadata = {
  title: "糸町の少年 | 大丈夫。必ずうまくいく。",
  description:
    "AIがあなたの生年月日・名前から今日の運気とネクストアクションを届ける占いサービス。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${shippori.variable} ${zenkaku.variable}`}>
      <body className="bg-lantern-gradient min-h-dvh font-body text-paper-50 antialiased">
        <Header />
        <main className="mx-auto min-h-dvh max-w-md pb-24 pt-14">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
