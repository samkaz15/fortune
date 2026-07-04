"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RankingItem {
  rank: number;
  category: string;
  label: string;
  count: number;
}

/**
 * CL21: 「今、みんなが受けている診断」ランキング(TOPページ用)。
 * 社会的証明でTikTok流入ユーザーの熱量を可視化する(IA設計書⑧のコンポーネント設計に対応)。
 * データが無い(リリース直後等)場合はセクションごと非表示にする。
 */
export function PopularRanking() {
  const [items, setItems] = useState<RankingItem[]>([]);

  useEffect(() => {
    fetch("/api/ranking")
      .then((res) => res.json())
      .then((d) => setItems(d.popularRanking ?? []))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-base text-paper-200">今、みんなが占っていること</h2>
      <div className="flex flex-col gap-2">
        {items.slice(0, 3).map((item) => (
          <Link
            key={item.category}
            href={`/consult?category=${item.category}`}
            className="flex items-center gap-3 rounded-card border border-ink-700 bg-ink-900/40 px-4 py-3"
          >
            <span className="font-display text-lg text-gold-400">{item.rank}</span>
            <span className="flex-1 text-sm text-paper-100">{item.label}</span>
            <span className="text-xs text-paper-600">今週 {item.count}件</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
