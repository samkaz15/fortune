"use client";

/**
 * トークション(電話占いオークション)ページ — 仕様書 docs/design/08_talkauction/talkauction_spec.md
 *
 * 構成(仕様書§オークションページ):
 *  1. 占い師プロフィール / 現在価格 / 残り時間 / 入札 / 落札するボタン
 *  2. 相談できる内容(管理APIから編集可能なtopics)
 *  3. レビュー(星+コメント。悪い評価も削除せず表示)
 *  4. 免責事項
 *
 * - 入札は確認モーダル経由(キャンセル不可同意+免責同意の2チェック必須)
 * - 現在価格/残り時間/自分の状態のみ5秒ポーリング(リロード不要・仕様書§リアルタイム更新)
 * - 残り時間はサーバー時刻(serverNow)基準で計算(クライアント時刻を信用しない)
 * - 終了後: 落札者には決済(Stripe)→決済完了後のみ予約画面へ(銀行振込はCEO判断で廃止 2026-07-06)
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { AffSlot } from "@/components/ui-common";

interface Ticket {
  id: string;
  title: string;
  description: string;
  profileText: string | null;
  topics: string[] | null;
  currentPriceJpy: number;
  status: string;
  opensAt: string;
  closesAt: string;
  version: number;
  _count?: { bids: number };
}

interface LiveStatus {
  status: string;
  currentPriceJpy: number;
  version: number;
  closesAt: string;
  serverNow: string;
  myBidJpy: number | null;
  isTopBidder: boolean;
  isWinner: boolean;
}

interface Review {
  rating: number;
  comment: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 5000;

export default function AuctionPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [remainMs, setRemainMs] = useState<number>(0);
  const serverOffsetRef = useRef<number>(0); // serverNow - clientNow

  const [modalOpen, setModalOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [agreeNoCancel, setAgreeNoCancel] = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [tRes, rRes] = await Promise.all([fetch("/api/auction"), fetch("/api/auction/reviews")]);
      const tData = await tRes.json();
      const first: Ticket | undefined = (tData.tickets ?? [])[0];
      if (first) setTicket(first);
      const rData = await rRes.json();
      setReviews(rData.reviews ?? []);
    })();
  }, []);

  const poll = useCallback(async () => {
    if (!ticket) return;
    const res = await fetch(`/api/auction/status?ticketId=${ticket.id}`);
    if (!res.ok) return;
    const data: LiveStatus = await res.json();
    setLive(data);
    serverOffsetRef.current = new Date(data.serverNow).getTime() - Date.now();
  }, [ticket]);

  useEffect(() => {
    if (!ticket) return;
    poll();
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [ticket, poll]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!live) return;
      const nowServer = Date.now() + serverOffsetRef.current;
      setRemainMs(Math.max(0, new Date(live.closesAt).getTime() - nowServer));
    }, 1000);
    return () => clearInterval(t);
  }, [live]);

  async function submitBid() {
    if (!ticket || !live) return;
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/billing/auction/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: ticket.id,
        amountJpy: Number(bidAmount),
        expectedVersion: live.version,
        agreedNoCancel: agreeNoCancel,
        agreedDisclaimer: agreeDisclaimer,
      }),
    });
    const data = await res.json();
    setPending(false);
    if (res.ok) {
      setModalOpen(false);
      setBidAmount("");
      setAgreeNoCancel(false);
      setAgreeDisclaimer(false);
      setMsg({ type: "ok", text: data.message ?? "入札を受け付けました。" });
      poll();
    } else if (data.error === "AUTH_REQUIRED") {
      setMsg({ type: "err", text: "入札にはログインが必要です。" });
    } else if (data.error === "BID_TOO_LOW" || data.error === "BID_CONFLICT") {
      setMsg({ type: "err", text: `${data.message}(現在価格: ${data.currentPriceJpy?.toLocaleString()}円)` });
      poll();
    } else if (data.error === "AUCTION_CLOSED") {
      setMsg({ type: "err", text: "このオークションは終了しています。" });
      poll();
    } else {
      setMsg({ type: "err", text: "入札に失敗しました。時間をおいて再度お試しください。" });
    }
  }

  async function startPayment(method: "stripe") {
    if (!ticket) return;
    setPending(true);
    const res = await fetch("/api/auction/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id, method }),
    });
    const data = await res.json();
    setPending(false);
    if (res.ok && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      setMsg({ type: "err", text: "決済の開始に失敗しました。" });
    }
  }

  if (!ticket) {
    return (
      <main className="mx-auto min-h-screen max-w-md px-4 py-16 text-center text-paper-300">
        <p className="text-sm">現在、開催中のトークションはありません。</p>
        <p className="mt-2 text-xs text-paper-500">出品は毎週 月曜7:00〜 と 金曜20:00〜(各24時間)です。</p>
      </main>
    );
  }

  const price = live?.currentPriceJpy ?? ticket.currentPriceJpy;
  const status = live?.status ?? ticket.status;
  const isOpen = status === "open" && remainMs > 0;
  const hh = Math.floor(remainMs / 3600000);
  const mm = Math.floor((remainMs % 3600000) / 60000);
  const ss = Math.floor((remainMs % 60000) / 1000);
  const topics: string[] = Array.isArray(ticket.topics) ? (ticket.topics as string[]) : [];

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-8 text-paper-100">
      <h1 className="mb-1 text-center text-lg font-bold text-gold-400">トークション</h1>
      <p className="mb-6 text-center text-[11px] text-paper-500">
        糸町の少年と直接話せる1時間(公式LINE電話)を、オークション形式でお分けしています
      </p>

      {msg && (
        <div
          className={`mb-4 rounded-card border p-3 text-xs ${
            msg.type === "ok" ? "border-gold-500/40 bg-gold-500/10 text-gold-300" : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ===== ① プロフィール・現在価格・残り時間・入札 ===== */}
      <section className="rounded-card border border-ink-700 bg-ink-900/60 p-5">
        <h2 className="text-base font-bold text-paper-100">{ticket.title}</h2>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-paper-400">
          {ticket.profileText ?? ticket.description}
        </p>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-paper-500">現在価格</p>
            <p className="text-3xl font-bold text-gold-400">
              {price.toLocaleString()}
              <span className="ml-1 text-sm">円</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-paper-500">残り時間</p>
            <p className={`font-mono text-xl font-bold ${remainMs < 3600000 ? "text-red-400" : "text-paper-100"}`}>
              {isOpen ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : "終了"}
            </p>
          </div>
        </div>

        {live?.myBidJpy != null && (
          <p className="mt-3 rounded-full bg-ink-800 px-4 py-2 text-center text-[11px] text-paper-300">
            あなたの入札: {live.myBidJpy.toLocaleString()}円{" "}
            {live.isTopBidder ? <b className="text-gold-400">(現在トップです)</b> : "(上回られています)"}
          </p>
        )}

        {isOpen ? (
          <button
            onClick={() => {
              setBidAmount(String(price));
              setModalOpen(true);
            }}
            className="mt-4 w-full rounded-full bg-gold-500 py-3.5 text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] transition active:translate-y-1 active:shadow-none"
          >
            落札する(入札へ)
          </button>
        ) : live?.isWinner && (status === "awaiting_payment" || status === "pending_bank") ? (
          <div className="mt-4 space-y-2">
            <p className="text-center text-xs font-bold text-gold-400">おめでとうございます、あなたが落札しました！</p>
            <button
              onClick={() => startPayment("stripe")}
              disabled={pending}
              className="w-full rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1 active:shadow-none disabled:opacity-50"
            >
              カードで支払う({price.toLocaleString()}円)
            </button>
            <p className="text-center text-[10px] text-paper-500">決済が完了すると、日程予約にお進みいただけます</p>
          </div>
        ) : live?.isWinner && status === "paid" ? (
          <a
            href={`/auction/reserve?ticketId=${ticket.id}`}
            className="mt-4 block w-full rounded-full bg-gold-500 py-3.5 text-center text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1"
          >
            日程を予約する
          </a>
        ) : (
          <p className="mt-4 rounded-full bg-ink-800 py-3 text-center text-xs text-paper-400">
            {status === "fulfilled" ? "この回は予約まで完了しました" : "このオークションは終了しました"}
          </p>
        )}
      </section>

      {/* ===== ② 相談できる内容 ===== */}
      <section className="mt-5 rounded-card border border-ink-700 bg-ink-900/60 p-5">
        <h3 className="mb-3 text-sm font-bold text-paper-200">相談できる内容</h3>
        <div className="flex flex-wrap gap-2">
          {(topics.length > 0 ? topics : ["仕事・キャリア", "恋愛・相性", "人間関係", "人生の転機", "その他なんでも"]).map((t) => (
            <span key={t} className="rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 text-[11px] text-paper-300">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ===== ③ レビュー(悪い評価も削除しない) ===== */}
      <section className="mt-5 rounded-card border border-ink-700 bg-ink-900/60 p-5">
        <h3 className="mb-3 text-sm font-bold text-paper-200">レビュー</h3>
        {reviews.length === 0 ? (
          <p className="text-xs text-paper-500">まだレビューはありません。</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r, i) => (
              <div key={i} className="border-b border-ink-800 pb-3 last:border-0">
                <p className="text-sm text-gold-400">
                  {"★".repeat(r.rating)}
                  <span className="text-ink-600">{"★".repeat(5 - r.rating)}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-paper-300">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] text-paper-500">※ 評価は良いものも厳しいものも、削除せずすべて掲載しています</p>
      </section>

      {/* ===== ④ 免責事項 ===== */}
      <section className="mt-5 rounded-card border border-ink-700 bg-ink-900/40 p-5">
        <h3 className="mb-2 text-sm font-bold text-paper-200">免責事項</h3>
        <ul className="list-inside list-disc space-y-1 text-[11px] leading-relaxed text-paper-500">
          <li>落札後のキャンセル・返金はできません。</li>
          <li>鑑定は助言の提供であり、結果や効果を保証するものではありません。</li>
          <li>医療・法律・投資等の専門的判断が必要な内容は、各専門家にご相談ください。</li>
          <li>通話は公式LINE電話で行います。録音はお控えください。</li>
          <li>迷惑行為があった場合、以後のご利用をお断りすることがあります。</li>
        </ul>
      </section>

      {/* ===== 入札確認モーダル(チェック2つ必須) ===== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-card border border-ink-600 bg-ink-900 p-5">
            <h3 className="text-sm font-bold text-paper-100">入札の確認</h3>
            <p className="mt-2 text-xs text-paper-400">
              現在価格: <b className="text-gold-400">{price.toLocaleString()}円</b>(この金額以上で入札できます)
            </p>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              min={price}
              className="mt-3 w-full rounded-full border border-ink-600 bg-ink-950 px-4 py-3 text-center text-lg font-bold text-paper-100 outline-none focus:border-gold-500"
            />
            <label className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-paper-300">
              <input type="checkbox" checked={agreeNoCancel} onChange={(e) => setAgreeNoCancel(e.target.checked)} className="mt-0.5" />
              落札後のキャンセル・返金ができないことを理解しました
            </label>
            <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-paper-300">
              <input type="checkbox" checked={agreeDisclaimer} onChange={(e) => setAgreeDisclaimer(e.target.checked)} className="mt-0.5" />
              免責事項に同意します
            </label>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setModalOpen(false)} className="flex-1 rounded-full border border-ink-600 py-3 text-xs font-bold text-paper-300">
                やめる
              </button>
              <button
                onClick={submitBid}
                disabled={pending || !agreeNoCancel || !agreeDisclaimer || Number(bidAmount) < price}
                className="flex-1 rounded-full bg-gold-500 py-3 text-xs font-bold text-ink-950 shadow-[0_3px_0_#8a6b25] active:translate-y-0.5 disabled:opacity-40"
              >
                {pending ? "送信中..." : "この金額で入札する"}
              </button>
            </div>
          </div>
        </div>
      )}
      <AffSlot />
    </main>
  );
}
