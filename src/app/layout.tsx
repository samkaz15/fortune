import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { MilkyWayBackground } from "@/components/MilkyWayBackground";

/**
 * フォントについて:
 * 当初 next/font/google (Shippori Mincho / Zen Kaku Gothic New) を使用していたが、
 * ビルド時にGoogle Fontsへ到達できない環境(オフラインCI等)でビルドが失敗するため、
 * globals.css の @import + font-family フォールバックチェーン方式に変更した。
 * オンライン環境ではGoogle Fontsが読み込まれ、オフラインではシステムフォントで表示される。
 */

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
    <html lang="ja">
      <body className="bg-lantern-gradient min-h-dvh font-body text-paper-50 antialiased">
        <MilkyWayBackground />
        <Header />
        <main className="relative z-10 mx-auto min-h-dvh max-w-md pb-24 pt-14">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
