"use client";

/**
 * トークション日程予約画面(仕様書§日程予約)
 * - 決済完了(paid)した落札者のみ空き枠を取得できる(/api/auction/slots が402/403でガード)
 * - 表示された候補から選択→POST /api/auction/reserve で確定
 * - 当日は占い師が公式LINEから手動で電話をかける(システム側の電話機能はなし)
 */
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Slot {
  startsAt: string;
  label: string;
}

function ReserveInner() {
  const params = useSearchParams();
  const ticketId = params.get("ticketId");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [errText, setErrText] = useState("");
  const [doneLabel, setDoneLabel] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setState("error");
      setErrText("チケットが指定されていません。");
      return;
    }
    (async () => {
      const res = await fetch(`/api/auction/slots?ticketId=${ticketId}`);
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots ?? []);
        setState("ready");
      } else if (data.error === "AUTH_REQUIRED") {
        setState("error");
        setErrText("ログインしてから、もう一度このページを開いてください。");
      } else if (data.error === "PAYMENT_REQUIRED") {
        setState("error");
        setErrText("お支払いの確認後に、日程を予約できるようになります。");
      } else if (data.error === "NOT_WINNER") {
        setState("error");
        setErrText("このチケットの落札者のみ予約できます。");
      } else {
        setState("error");
        setErrText("空き枠の取得に失敗しました。");
      }
    })();
  }, [ticketId]);

  async function reserve() {
    if (!ticketId || !selected) return;
    setPending(true);
    const res = await fetch("/api/auction/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, startsAt: selected }),
    });
    const data = await res.json();
    setPending(false);
    if (res.ok) {
      const slot = slots.find((s) => s.startsAt === selected);
      setDoneLabel(slot?.label ?? "");
      setState("done");
    } else if (data.error === "SLOT_TAKEN") {
      setErrText("その枠は先に埋まってしまいました。別の枠をお選びください。");
      const r = await fetch(`/api/auction/slots?ticketId=${ticketId}`);
      const d = await r.json();
      if (r.ok) setSlots(d.slots ?? []);
      setSelected(null);
    } else if (data.error === "ALREADY_RESERVED") {
      setErrText("このチケットはすでに予約済みです。");
    } else {
      setErrText("予約に失敗しました。時間をおいて再度お試しください。");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-10 text-paper-100">
      <h1 className="mb-2 text-center text-lg font-bold text-gold-400">日程のご予約</h1>

      {state === "loading" && <p className="mt-10 text-center text-xs text-paper-500">空き枠を確認しています、、</p>}

      {state === "error" && (
        <div className="mt-8 rounded-card border border-ink-700 bg-ink-900/60 p-5 text-center">
          <p className="text-xs leading-relaxed text-paper-300">{errText}</p>
          <a href="/auction" className="mt-4 inline-block rounded-full border border-ink-600 px-6 py-2.5 text-xs font-bold text-paper-200">
            トークションに戻る
          </a>
        </div>
      )}

      {state === "ready" && (
        <>
          <p className="mb-5 text-center text-[11px] leading-relaxed text-paper-500">
            ご都合のよい枠をひとつ選んでください。
            <br />
            当日は、占い師が公式LINEからお電話します。
          </p>
          {errText && <p className="mb-3 rounded-card border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{errText}</p>}
          <div className="space-y-2">
            {slots.length === 0 && <p className="text-center text-xs text-paper-500">現在、選択できる枠がありません。少し時間をおいてお試しください。</p>}
            {slots.map((s) => (
              <button
                key={s.startsAt}
                onClick={() => setSelected(s.startsAt)}
                className={`w-full rounded-full border px-4 py-3 text-sm font-bold transition ${
                  selected === s.startsAt
                    ? "border-gold-500 bg-gold-500/10 text-gold-300"
                    : "border-ink-700 bg-ink-900/60 text-paper-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={reserve}
            disabled={!selected || pending}
            className="mt-6 w-full rounded-full bg-gold-500 py-3.5 text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1 active:shadow-none disabled:opacity-40"
          >
            {pending ? "確定しています..." : "この日時で予約する"}
          </button>
        </>
      )}

      {state === "done" && (
        <div className="mt-8 rounded-card border border-gold-500/40 bg-gold-500/5 p-6 text-center">
          <p className="text-2xl">🎉</p>
          <p className="mt-2 text-sm font-bold text-gold-300">予約が確定しました</p>
          <p className="mt-2 text-xs text-paper-300">{doneLabel}</p>
          <p className="mt-4 text-[11px] leading-relaxed text-paper-500">
            当日のお時間になりましたら、
            <br />
            占い師が公式LINEからお電話します。
            <br />
            通知をオンにしてお待ちください。
          </p>
          <a href="/" className="mt-5 inline-block rounded-full border border-ink-600 px-6 py-2.5 text-xs font-bold text-paper-200">
            ホームに戻る
          </a>
        </div>
      )}
    </main>
  );
}

export default function ReservePage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen max-w-md px-4 pt-16 text-center text-xs text-paper-500">読み込み中...</main>}>
      <ReserveInner />
    </Suspense>
  );
}
