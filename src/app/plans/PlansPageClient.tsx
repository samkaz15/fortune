"use client";
import { AffSlot } from "@/components/ui-common";
import { track } from "@/lib/track-client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * 画面遷移設計書「料金・決済画面」の実装。
 * サブスクと追加クレジットを2画面に分けず、同一画面内タブ切替にする設計判断済み(WBS回答参照)。
 *
 * 課金導線改善(2026-07-07・Marketing-006): fromクエリ(元の診断ページ)があれば
 * Checkout API(/api/billing/subscribe)に渡し、決済完了後にその場で
 * ロックが解ける体験にする。useSearchParams()はSuspense境界が必要なため
 * 内部コンポーネントに分離している(既存のplans/completeページと同じパターン)。
 */
export default function PlansPageClient() {
  return (
    <Suspense fallback={null}>
      <PlansPageInner />
    </Suspense>
  );
}

function PlansPageInner() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [tab, setTab] = useState<"subscribe" | "credit">("subscribe");
  const [loading, setLoading] = useState(false);

  async function startCheckout(kind: "subscribe" | "credit") {
    setLoading(true);
    track("checkout_started", { kind, from }); // 計測基盤(2026-07-07・Marketing-083)
    try {
      const res = await fetch(`/api/billing/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error ?? "決済の準備に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-4">
      <h1 className="font-display text-lg text-paper-50">料金プラン</h1>

      <div className="flex rounded-full border border-ink-700 bg-ink-900/50 p-1">
        <TabButton active={tab === "subscribe"} onClick={() => setTab("subscribe")} label="サブスク" />
        <TabButton active={tab === "credit"} onClick={() => setTab("credit")} label="追加クレジット" />
      </div>

      {tab === "subscribe" ? (
        <section className="rounded-card border border-gold-500/40 bg-ink-900/60 p-6">
          <p className="mb-1 text-xs font-bold text-gold-400">ずっと、そばに。</p>
          <p className="mb-4 font-display text-2xl text-paper-50">
            初月 <span className="text-gold-400">500円</span>
          </p>
          <p className="mb-4 text-sm text-paper-400">2ヶ月目から 月980円</p>
          <ul className="mb-4 space-y-2 text-sm text-paper-200">
            <li>・診断回数の上限なし</li>
            <li>・結果はいつでも全文読める</li>
            <li>・週替わりオークションへの参加権</li>
          </ul>
          <p className="mb-6 text-xs text-paper-600">いつでも、ここでやめられます。</p>
          <button
            onClick={() => startCheckout("subscribe")}
            disabled={loading}
            className="w-full rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950 disabled:opacity-40"
          >
            このまま始める
          </button>
        </section>
      ) : (
        <section className="rounded-card border border-ink-700 bg-ink-900/60 p-6">
          <p className="mb-1 text-xs font-bold text-paper-400">もう少しだけ、話したい日に。</p>
          <p className="mb-4 font-display text-2xl text-paper-50">
            300円 <span className="text-sm text-paper-400">で、5回分</span>
          </p>
          <p className="mb-6 text-sm text-paper-400">
            今日の無料分を使い切っても、その場で続けられます。
          </p>
          <button
            onClick={() => startCheckout("credit")}
            disabled={loading}
            className="w-full rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950 disabled:opacity-40"
          >
            続きを聞く
          </button>
        </section>
      )}
      <AffSlot />
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-sm transition ${
        active ? "bg-gold-500 font-bold text-ink-950" : "text-paper-400"
      }`}
    >
      {label}
    </button>
  );
}
