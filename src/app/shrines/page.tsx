"use client";

import { useEffect, useState } from "react";
import { AffSlot } from "@/components/ui-common";
import Link from "next/link";

interface ShrineItem {
  id: string;
  name: string;
  prefecture: string;
  city: string;
  tags: string[];
  hasCeoReview: boolean;
}

/**
 * CL18: おすすめ神社一覧。
 * CEOが実際に参拝した神社には「参拝済み」バッジを表示する
 * (プロジェクト概要の「一般情報→実参拝→レビュー追加→配信」フローの可視化)。
 */
export default function ShrinesPage() {
  const [shrines, setShrines] = useState<ShrineItem[]>([]);
  const [recommendation, setRecommendation] = useState<{ shrineId: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shrines")
      .then((res) => res.json())
      .then((d) => {
        setShrines(d.shrines ?? []);
        setRecommendation(d.recommendation ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const recommended = recommendation ? shrines.find((s) => s.id === recommendation.shrineId) : null;

  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <h1 className="font-display text-lg text-paper-50">おすすめ神社</h1>

      {loading && <p className="text-center text-sm text-paper-400">読み込み中…</p>}

      {recommended && recommendation && (
        <Link
          href={`/shrines/${recommended.id}`}
          className="rounded-card border border-gold-500/50 bg-ink-900/70 p-5 shadow-lantern"
        >
          <p className="mb-1 text-xs font-bold text-gold-400">今日のあなたへ</p>
          <p className="font-display text-base text-paper-50">{recommended.name}</p>
          <p className="mt-1 text-xs text-paper-400">
            {recommended.prefecture} {recommended.city}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-paper-200">{recommendation.reason}</p>
        </Link>
      )}

      <div className="flex flex-col gap-2">
        {shrines.map((s) => (
          <Link
            key={s.id}
            href={`/shrines/${s.id}`}
            className="flex items-center justify-between rounded-card border border-ink-700 bg-ink-900/40 px-4 py-3"
          >
            <div>
              <p className="text-sm text-paper-100">{s.name}</p>
              <p className="text-xs text-paper-600">
                {s.prefecture} {s.city}
              </p>
            </div>
            {s.hasCeoReview && (
              <span className="shrink-0 rounded-full border border-torii-500/60 px-2 py-0.5 text-[10px] text-torii-500">
                参拝済み
              </span>
            )}
          </Link>
        ))}
        {!loading && shrines.length === 0 && (
          <p className="text-center text-sm text-paper-400">神社情報は順次追加していきます。</p>
        )}
      </div>
          <AffSlot />
    </div>
  );
}
