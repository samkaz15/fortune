"use client";

/**
 * ChatWindow (Step3 / 2026-07-12)
 * 「今日の運勢レポート」の上に設置するチャットUI(CEO指示: チャット画面はレポートの上)。
 * カテゴリは "TODAY" 固定(レポート起点の相談という位置づけ)。
 * セッションは初回マウント時に取得/作成し、以後は同一sessionIdで継続する。
 */
import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatWindow() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "TODAY" }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setSessionId(data.sessionId);
        setMessages(data.messages.map((m: ChatMessage) => ({ id: m.id, role: m.role, content: m.content })));
      })
      .catch(() => setError("チャットの準備に失敗しました。時間をおいて再度お試しください"));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !sessionId || sending) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (res.status === 401) {
        setError("続きはログインすると相談できます!");
        return;
      }
      if (res.status === 402) {
        const d = await res.json().catch(() => null);
        setError(
          d?.plan === "paid"
            ? "今日の相談枠(5回)を使い切りました。また明日お待ちしてます!"
            : "今日の無料相談枠を使い切りました。プレミアムなら1日5回まで相談できます!"
        );
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("送信に失敗しました。もう一度送ってみてください");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex flex-col rounded-card border border-ink-700 bg-ink-900/60 shadow-lantern">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-paper-100">今日のことを相談する</span>
        <span className="text-xs text-paper-400">{expanded ? "閉じる" : "開く"}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-ink-700 px-5 py-4">
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-sm text-paper-400">今日の運勢について、気になることを聞いてみてください!</p>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? i} className={m.role === "user" ? "self-end" : "self-start"}>
                <div
                  className={
                    "whitespace-pre-line rounded-2xl px-4 py-2 text-sm " +
                    (m.role === "user" ? "bg-paper-100 text-ink-900" : "bg-ink-800 text-paper-100")
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="相談したいことを入力…"
              disabled={sending || !sessionId}
              className="flex-1 rounded-full border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-paper-100 placeholder:text-paper-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !sessionId || !input.trim()}
              className="rounded-full bg-paper-100 px-4 py-2 text-sm font-medium text-ink-900 disabled:opacity-40"
            >
              送信
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
