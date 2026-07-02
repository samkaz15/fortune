"use client";

import { useEffect, useState, useCallback } from "react";

interface Ticket {
  id: string;
  title: string;
  description: string;
  startPriceJpy: number;
  currentPriceJpy: number;
  status: "scheduled" | "open" | "closed" | "fulfilled";
  opensAt: string;
  closesAt: string;
  version: number;
  _count: { bids: number };
}

const POLL_INTERVAL_MS = 5000; // リアルタイム性はコスト優先でポーリング方式(WBS判断済み)

/** 画面遷移設計書「オークション一覧」+「入札/落札確認」を1画面に統合した実装 */
export default function AuctionPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    const res = await fetch("/api/auction");
    const data = await res.json();
    setTickets(data.tickets ?? []);
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  async function placeBid(ticket: Ticket) {
    const amount = Number(bidInputs[ticket.id]);
    const minimumAcceptable = ticket.currentPriceJpy + 100;
    if (!amount || amount < minimumAcceptable) {
      setErrorMsg(`${minimumAcceptable.toLocaleString()}円以上を入力してください(100円刻み)`);
      return;
    }
    setPending(ticket.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/billing/auction/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, amountJpy: amount, expectedVersion: ticket.version }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? "入札できませんでした。最新価格を確認してください。");
      } else {
        setSuccessMsg("入札を受け取りました。ここからの流れは、そっと見守っていてくださいね。");
      }
      await fetchTickets();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <div>
        <h1 className="font-display text-lg text-torii-500">週にいちど、糸町の少年と直接話せる時間。</h1>
        <p className="mt-1 text-xs text-paper-400">
          1つの枠を、24時間の入札でお分けしています。落札特典は公式LINE電話で1時間。
        </p>
      </div>

      {tickets.length === 0 && <p className="text-sm text-paper-400">現在開催中のオークションはありません。</p>}

      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-card border border-torii-500/30 bg-ink-900/50 p-5">
          <h2 className="font-display text-base text-paper-50">{ticket.title}</h2>
          <p className="mt-1 text-xs text-paper-400">{ticket.description}</p>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs text-paper-400">今の入札額</span>
            <span className="font-display text-2xl text-gold-400">{ticket.currentPriceJpy.toLocaleString()}円</span>
          </div>
          <p className="mt-1 text-right text-[11px] text-paper-600">{ticket._count.bids}件の入札</p>
          <CountdownLabel closesAt={ticket.closesAt} />

          {ticket.status === "open" && (
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                step={100}
                placeholder={`${(ticket.currentPriceJpy + 100).toLocaleString()}円〜(100円刻み)`}
                value={bidInputs[ticket.id] ?? ""}
                onChange={(e) => setBidInputs((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                className="flex-1 rounded-full border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-paper-50 outline-none focus-visible:border-gold-500"
              />
              <button
                onClick={() => placeBid(ticket)}
                disabled={pending === ticket.id}
                className="rounded-full bg-torii-500 px-4 py-2 text-sm font-bold text-paper-50 disabled:opacity-40"
              >
                入札する
              </button>
            </div>
          )}
        </div>
      ))}

      {errorMsg && <p className="text-center text-xs text-torii-500">{errorMsg}</p>}
      {successMsg && <p className="text-center text-xs text-gold-400">{successMsg}</p>}
    </div>
  );
}

function CountdownLabel({ closesAt }: { closesAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const diffMs = new Date(closesAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setRemaining("終了しました");
        return;
      }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setRemaining(`残り${hours}時間${minutes}分`);
    }
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [closesAt]);

  return <p className="mt-1 text-[11px] text-torii-500">{remaining}</p>;
}
