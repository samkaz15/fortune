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
  startPriceJpy: number;
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
  bidCount: number;
  version: number;
  opensAt: string;
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

/** 開催日時のJST表示(例: 7月13日(月) 7:00) */
function formatJstDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" });
  const time = d.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "2-digit" });
  return `${date} ${time}`;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hh = Math.floor((totalSec % 86400) / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return days > 0
    ? `${days}日 ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function AuctionPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [remainMs, setRemainMs] = useState<number>(0); // 終了までの残り時間
  const [untilOpenMs, setUntilOpenMs] = useState<number>(0); // 開催までの残り時間(開催前のみ)
  const [nextWindow, setNextWindow] = useState<{ opensAt: string; closesAt: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const serverOffsetRef = useRef<number>(0); // serverNow - clientNow
  const autoSwitchFiredFor = useRef<string | null>(null); // 開催到達時の自動切替を1回に制限

  const [modalOpen, setModalOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [agreeNoCancel, setAgreeNoCancel] = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchCatalog = useCallback(async () => {
    const res = await fetch("/api/auction");
    if (!res.ok) return;
    const data = await res.json();
    const first: Ticket | undefined = (data.tickets ?? [])[0];
    setTicket(first ?? null);
    if (data.serverNow) serverOffsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    // 未出品時のカウントダウン先: 開始時刻が未来の直近ウィンドウ(進行中だが未出品の枠は対象外)
    const serverNowMs = data.serverNow ? new Date(data.serverNow).getTime() : Date.now();
    const windows: { opensAt: string; closesAt: string }[] = data.nextWindows ?? [];
    setNextWindow(windows.find((w) => new Date(w.opensAt).getTime() > serverNowMs) ?? windows[0] ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchCatalog();
    (async () => {
      const rRes = await fetch("/api/auction/reviews");
      const rData = await rRes.json();
      setReviews(rData.reviews ?? []);
    })();
  }, [fetchCatalog]);

  // 開催前(チケット未出品/scheduled)は30秒毎に一覧を再取得し、出品や開始を取りこぼさない
  useEffect(() => {
    if (ticket && ticket.status !== "scheduled") return;
    const t = setInterval(fetchCatalog, 30000);
    return () => clearInterval(t);
  }, [ticket, fetchCatalog]);

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
      const nowServer = Date.now() + serverOffsetRef.current;
      if (live) setRemainMs(Math.max(0, new Date(live.closesAt).getTime() - nowServer));
      const opensAtIso = ticket?.status === "scheduled" ? ticket.opensAt : !ticket ? nextWindow?.opensAt : null;
      if (opensAtIso) {
        const until = new Date(opensAtIso).getTime() - nowServer;
        setUntilOpenMs(Math.max(0, until));
        // 開催時刻到達: サーバー側lazy遷移(scheduled→open)を踏んでUIを自動切替(要件②)。
        // 同一開催時刻につき1回だけ発火(未出品時の連続再取得を防ぐ。以降は30秒毎の定期再取得が拾う)
        if (until <= 0 && autoSwitchFiredFor.current !== opensAtIso) {
          autoSwitchFiredFor.current = opensAtIso;
          fetchCatalog();
          poll();
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [live, ticket, nextWindow, fetchCatalog, poll]);

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
    } else if (data.error === "BID_TOO_LOW" || data.error === "BID_INVALID_STEP" || data.error === "BID_CONFLICT") {
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

  if (!loaded) {
    return (
      <main className="mx-auto min-h-screen max-w-md px-4 py-16 text-center text-paper-500">
        <p className="text-sm">読み込み中...</p>
      </main>
    );
  }

  // チケット未出品でも完成版UIのレイアウトは表示する(要件②)。
  // 次回開催ウィンドウを使ったプレースホルダーで描画し、開始と同時に実チケットへ切り替わる。
  const view: Ticket = ticket ?? {
    id: "",
    title: "錦糸町の少年と話せる1時間",
    description: "",
    profileText:
      "カエルの男の子「錦糸町の少年」が、公式LINE電話で1時間、あなたの相談に直接お答えします。仕事も恋愛も人間関係も、まとめてどうぞ。",
    topics: null,
    startPriceJpy: 1000,
    currentPriceJpy: 1000,
    status: "scheduled",
    opensAt: nextWindow?.opensAt ?? new Date().toISOString(),
    closesAt: nextWindow?.closesAt ?? new Date().toISOString(),
    version: 0,
  };

  const price = live?.currentPriceJpy ?? view.currentPriceJpy;
  const status = ticket ? (live?.status ?? ticket.status) : "scheduled";
  const isOpen = Boolean(ticket) && status === "open" && remainMs > 0;
  const preOpen = !isOpen && (status === "scheduled" || !ticket) && untilOpenMs >= 0 && Boolean(ticket?.status === "scheduled" || nextWindow);
  const opensAtIso = ticket?.status === "scheduled" ? ticket.opensAt : !ticket ? nextWindow?.opensAt ?? null : null;
  // 100円刻みルール: 入札0件なら開始価格ちょうど、以降は現在価格+100円が最低額
  const minBidJpy = (live?.bidCount ?? ticket?._count?.bids ?? 0) > 0 ? price + 100 : (ticket?.startPriceJpy ?? 1000);
  const hh = Math.floor(remainMs / 3600000);
  const mm = Math.floor((remainMs % 3600000) / 60000);
  const ss = Math.floor((remainMs % 60000) / 1000);
  const topics: string[] = Array.isArray(view.topics) ? (view.topics as string[]) : [];

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-8 text-paper-100">
      <h1 className="mb-1 text-center text-lg font-bold text-gold-400">トークション</h1>
      <p className="mb-6 text-center text-[11px] text-paper-500">
        錦糸町の少年と直接話せる1時間(公式LINE電話)を、オークション形式でお分けしています
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
        <h2 className="text-base font-bold text-paper-100">{view.title}</h2>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-paper-400">
          {view.profileText ?? view.description}
        </p>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-paper-500">{preOpen ? "開始価格" : "現在価格"}</p>
            <p className="text-3xl font-bold text-gold-400">
              {(preOpen ? view.startPriceJpy : price).toLocaleString()}
              <span className="ml-1 text-sm">円</span>
            </p>
          </div>
          <div className="text-right">
            {!preOpen && typeof live?.bidCount === "number" && live.bidCount > 0 && (
              <p className="mb-0.5 text-right text-[10px] text-gold-300">🔥 現在{live.bidCount}件の入札</p>
            )}
            <p className="text-[10px] text-paper-500">{preOpen ? "開催まで" : "残り時間"}</p>
            <p className={`font-mono text-xl font-bold ${preOpen ? "text-paper-100" : remainMs < 3600000 ? "text-red-400" : "text-paper-100"}`}>
              {preOpen ? formatCountdown(untilOpenMs) : isOpen ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : "終了"}
            </p>
          </div>
        </div>

        {live?.myBidJpy != null && (
          <p className="mt-3 rounded-full bg-ink-800 px-4 py-2 text-center text-[11px] text-paper-300">
            あなたの入札: {live.myBidJpy.toLocaleString()}円{" "}
            {live.isTopBidder ? <b className="text-gold-400">(現在トップです)</b> : "(上回られています)"}
          </p>
        )}

        {preOpen ? (
          <div className="mt-4 space-y-2">
            {opensAtIso && (
              <p className="rounded-card border border-gold-500/30 bg-gold-500/5 py-2.5 text-center text-xs text-gold-300">
                次回開催: <b>{formatJstDateTime(opensAtIso)}</b> 〜(24時間)
              </p>
            )}
            <button
              disabled
              aria-disabled="true"
              className="w-full cursor-not-allowed rounded-full bg-ink-800 py-3.5 text-sm font-bold text-paper-500"
            >
              🔒 開催までお待ちください
            </button>
            <p className="text-center text-[10px] text-paper-500">
              開催時間になると、このまま自動で入札できるようになります(1,000円スタート・100円刻み)
            </p>
          </div>
        ) : isOpen ? (
          <button
            onClick={() => {
              setBidAmount(String(minBidJpy));
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
            href={`/auction/reserve?ticketId=${view.id}`}
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
              現在価格: <b className="text-gold-400">{price.toLocaleString()}円</b>(入札は{minBidJpy.toLocaleString()}円から・100円刻み)
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBidAmount(String(Math.max(minBidJpy, Number(bidAmount) - 100)))}
                disabled={Number(bidAmount) <= minBidJpy}
                className="h-12 w-12 shrink-0 rounded-full border border-ink-600 bg-ink-800 text-lg font-bold text-paper-200 disabled:opacity-30"
                aria-label="100円下げる"
              >
                −
              </button>
              <input
                type="text"
                inputMode="none"
                readOnly
                value={`${Number(bidAmount).toLocaleString()}円`}
                className="w-full rounded-full border border-ink-600 bg-ink-950 px-4 py-3 text-center text-lg font-bold text-paper-100 outline-none"
                aria-label="入札金額(100円刻み)"
              />
              <button
                type="button"
                onClick={() => setBidAmount(String(Number(bidAmount) + 100))}
                className="h-12 w-12 shrink-0 rounded-full border border-gold-500/50 bg-gold-500/15 text-lg font-bold text-gold-300"
                aria-label="100円上げる"
              >
                ＋
              </button>
            </div>
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
                disabled={pending || !agreeNoCancel || !agreeDisclaimer || Number(bidAmount) < minBidJpy || Number(bidAmount) % 100 !== 0}
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
