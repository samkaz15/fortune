"use client";

import { useState } from "react";

/**
 * 画面遷移設計書「料金・決済画面」の実装。
 * サブスクと追加クレジットを2画面に分けず、同一画面内タブ切替にする設計判断済み(WBS回答参照)。
 */
export default function PlansPage() {
  const [tab, setTab] = useState<"subscribe" | "credit">("subscribe");
  const [loading, setLoading] = useState(false);

  async function startCheckout(kind: "subscribe" | "credit") {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/${kind}`, { method: "POST" });
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
          <p className="mb-1 text-xs font-bold text-gold-400">一番人気</p>
          <p className="mb-4 font-display text-2xl text-paper-50">
            初月 <span className="text-gold-400">500円</span>
          </p>
          <p className="mb-4 text-sm text-paper-400">2ヶ月目以降 月額980円</p>
          <ul className="mb-6 space-y-2 text-sm text-paper-200">
            <li>・診断回数の上限なし</li>
            <li>・結果を全文いつでも解放</li>
            <li>・オークションへの入札権</li>
          </ul>
          <button
            onClick={() => startCheckout("subscribe")}
            disabled={loading}
            className="w-full rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950 disabled:opacity-40"
          >
            このプランで始める
          </button>
        </section>
      ) : (
        <section className="rounded-card border border-ink-700 bg-ink-900/60 p-6">
          <p className="mb-4 font-display text-2xl text-paper-50">
            300円 <span className="text-sm text-paper-400">/ 5回分</span>
          </p>
          <p className="mb-6 text-sm text-paper-400">
            1日の無料分(5回)を使い切ったときに、その場で追加できます。
          </p>
          <button
            onClick={() => startCheckout("credit")}
            disabled={loading}
            className="w-full rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950 disabled:opacity-40"
          >
            クレジットを追加する
          </button>
        </section>
      )}
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
