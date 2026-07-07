"use client";

/**
 * CL28: BIダッシュボード(社内用・簡易版)
 * ADMIN_SECRETを入力して /api/admin/analytics を読む。
 * 本番運用ではMetabase/Looker等の専用BIに移行する想定(scale_architecture.md参照)。
 */
import { useState } from "react";

interface Analytics {
  kpi: { totalUsers: number; activeSubscriptions: number; creditBuyers14d: number; subscriptionRate: number };
  retention: { d1: number | null; d7: number | null; d30: number | null; cohortSizes: { d1: number; d7: number; d30: number } };
  funnel: { freeReadingCompleted: number; checkoutStarted: number; subscriptionStarted: number; cvrReadingToCheckout: number; cvrCheckoutToSubscription: number };
  ltv: { approxPerUserJpy: number; note: string };
  categoryPopularity: { category: string; sessions: number }[];
  dailySummary: { day: string; name: string; events: number; uniqueUsers: number; totalTokens: number }[];
}

export default function AdminAnalyticsPage() {
  const [secret, setSecret] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/admin/analytics", { headers: { "x-admin-secret": secret } });
    if (!res.ok) {
      setError(res.status === 401 ? "シークレットが違います" : "取得に失敗しました");
      return;
    }
    setData(await res.json());
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 text-paper-100">
      <h1 className="mb-6 text-xl font-bold text-gold-400">運営ダッシュボード(CL28)</h1>

      <div className="mb-8 flex gap-2">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          className="flex-1 rounded-full border border-ink-700 bg-ink-900 px-4 py-2 text-sm outline-none focus:border-gold-500"
        />
        <button onClick={load} className="rounded-full bg-gold-500 px-6 py-2 text-sm font-bold text-ink-950">
          表示
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {data && (
        <div className="space-y-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["総ユーザー", data.kpi.totalUsers],
              ["有効サブスク", data.kpi.activeSubscriptions],
              ["課金率(%)", data.kpi.subscriptionRate],
              ["クレジット購入者(14d)", data.kpi.creditBuyers14d],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-card border border-ink-700 bg-ink-900/60 p-4 text-center">
                <p className="text-2xl font-bold text-gold-400">{String(value)}</p>
                <p className="mt-1 text-[11px] text-paper-400">{label}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold text-paper-300">継続率(リテンション)</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["D1継続率", data.retention.d1, data.retention.cohortSizes.d1],
                ["D7継続率", data.retention.d7, data.retention.cohortSizes.d7],
                ["D30継続率", data.retention.d30, data.retention.cohortSizes.d30],
              ].map(([label, value, cohort]) => (
                <div key={String(label)} className="rounded-card border border-ink-700 bg-ink-900/60 p-4 text-center">
                  <p className="text-2xl font-bold text-torii-500">{value === null ? "—" : `${value}%`}</p>
                  <p className="mt-1 text-[11px] text-paper-400">{label}</p>
                  <p className="mt-0.5 text-[9px] text-paper-600">母数{cohort}人</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold text-paper-300">課金ファネル・LTV</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-card border border-ink-700 bg-ink-900/60 p-4 text-center">
                <p className="text-lg font-bold text-gold-400">{data.funnel.freeReadingCompleted} → {data.funnel.checkoutStarted}</p>
                <p className="mt-1 text-[11px] text-paper-400">無料占い完了→課金開始</p>
                <p className="mt-0.5 text-[9px] text-paper-600">CVR {data.funnel.cvrReadingToCheckout}%</p>
              </div>
              <div className="rounded-card border border-ink-700 bg-ink-900/60 p-4 text-center">
                <p className="text-lg font-bold text-gold-400">{data.funnel.checkoutStarted} → {data.funnel.subscriptionStarted}</p>
                <p className="mt-1 text-[11px] text-paper-400">課金開始→サブスク登録</p>
                <p className="mt-0.5 text-[9px] text-paper-600">CVR {data.funnel.cvrCheckoutToSubscription}%</p>
              </div>
              <div className="rounded-card border border-ink-700 bg-ink-900/60 p-4 text-center">
                <p className="text-lg font-bold text-gold-400">¥{data.ltv.approxPerUserJpy.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-paper-400">LTV(簡易・ユーザー単価)</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-paper-600">{data.ltv.note}</p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold text-paper-300">診断カテゴリ人気(14日)</h2>
            <div className="space-y-2">
              {data.categoryPopularity.map((c) => (
                <div key={c.category} className="flex items-center gap-3 text-sm">
                  <span className="w-32 text-paper-400">{c.category}</span>
                  <span className="font-bold text-paper-100">{c.sessions}件</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold text-paper-300">日次イベント(DWH: dwh_daily_summary)</h2>
            <div className="overflow-x-auto rounded-card border border-ink-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-900 text-paper-400">
                  <tr>
                    <th className="p-2">日付</th><th className="p-2">イベント</th>
                    <th className="p-2">件数</th><th className="p-2">UU</th><th className="p-2">tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailySummary.map((d, i) => (
                    <tr key={i} className="border-t border-ink-800">
                      <td className="p-2">{String(d.day).slice(0, 10)}</td>
                      <td className="p-2">{d.name}</td>
                      <td className="p-2">{d.events}</td>
                      <td className="p-2">{d.uniqueUsers}</td>
                      <td className="p-2">{d.totalTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
