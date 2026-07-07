import type { MetadataRoute } from "next";

/**
 * sitemap.xml(SEO基盤 2026-07-07・Marketing-032)。
 * クロール対象は公開ページのみ(認証必須ページ・管理画面は除外)。
 * 診断ページ(self/love/work)・今日の運勢・神社・カレンダーを優先度高めに設定。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const now = new Date();

  const highPriority: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/self", priority: 0.9, changeFrequency: "weekly" },
    { path: "/love", priority: 0.9, changeFrequency: "weekly" },
    { path: "/work", priority: 0.9, changeFrequency: "weekly" },
    { path: "/report", priority: 0.8, changeFrequency: "daily" },
    { path: "/calendar", priority: 0.7, changeFrequency: "weekly" },
    { path: "/shrines", priority: 0.7, changeFrequency: "weekly" },
    { path: "/auction", priority: 0.6, changeFrequency: "daily" },
    { path: "/news", priority: 0.5, changeFrequency: "weekly" },
    { path: "/plans", priority: 0.6, changeFrequency: "monthly" },
    { path: "/support", priority: 0.4, changeFrequency: "monthly" },
    { path: "/legal/terms", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/tokushoho", priority: 0.2, changeFrequency: "yearly" },
  ];

  return highPriority.map((p) => ({
    url: `${base}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
