import type { MetadataRoute } from "next";

/**
 * robots.txt(SEO基盤 2026-07-07・Marketing-032)。
 * 管理画面・API・個人設定ページはクロール対象外にする。
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/mypage/", "/auth/", "/plans/complete"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
