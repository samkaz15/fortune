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

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
import { SITE_NAME, SITE_NAME_EN, SITE_TAGLINE } from "@/lib/site";
const SITE_DESCRIPTION =
  "AIがあなたの生年月日・名前から今日の運気とネクストアクションを届ける占いサービス。四柱推命・算命学・姓名判断をもとに、恋愛・仕事・today's fortuneを毎日診断。";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: SITE_NAME_EN,
  title: { default: `${SITE_NAME} | ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: APP_URL,
    locale: "ja_JP",
    images: [{ url: "/character/home_dark.jpg", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ["/character/home_dark.jpg"],
  },
  robots: { index: true, follow: true },
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
        {/* JSON-LD構造化データ(SEO基盤 2026-07-07・Marketing-029): Organization+WebSite */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "株式会社Viwe Point",
                  url: APP_URL,
                  logo: `${APP_URL}/character/home_dark.jpg`,
                },
                {
                  "@type": "WebSite",
                  name: SITE_NAME,
                  url: APP_URL,
                  inLanguage: "ja-JP",
                },
              ],
            }),
          }}
        />
        <MilkyWayBackground />
        <script
          type="application/ld+json"
          // SEO/AEO: WebSite+Organization構造化データ(マーケ03章/Marketing-029系)
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                { "@type": "WebSite", name: SITE_NAME, alternateName: SITE_NAME_EN, url: APP_URL, inLanguage: "ja" },
                { "@type": "Organization", name: "株式会社Viwe Point", url: `${APP_URL}/legal/company` },
              ],
            }),
          }}
        />
        <Header />
        <main className="relative z-10 mx-auto min-h-dvh max-w-md pb-24 pt-14">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
