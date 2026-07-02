"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Category = "RELATIONSHIP" | "SELF" | "BUSINESS" | "COMPATIBILITY" | "TODAY";

const CATEGORY_LABEL: Record<Category, string> = {
  RELATIONSHIP: "人間関係",
  SELF: "自分のこと",
  BUSINESS: "ビジネス",
  COMPATIBILITY: "相性",
  TODAY: "今日の占い",
};

const CATEGORY_PROMPT: Record<Category, string> = {
  RELATIONSHIP: "人間関係のことだね。今、気になっている相手やできごとを教えて。",
  SELF: "自分のことだね。今どんなことにモヤモヤしてる?",
  BUSINESS: "ビジネスのことだね。今のキャリアで気になっていることを教えて。",
  COMPATIBILITY: "相性を見るには、相手の名前と生年月日も必要だよ。まずは相談内容を教えて。",
  TODAY: "今日の運気を見るね。何か気をつけたいことはある?（なければ「特になし」でOK）",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 画面遷移設計書「診断入力フォーム」に相当する部分を、5診断メニューに分割せず
 * 1つのチャットUIに統合したもの(WBS改訂の中核判断)。
 * category が未確定の場合は、最初にAIが「どの相談?」と聞く導線をカード選択で代替している
 * (毎回タイプさせるよりタップで選ばせた方が離脱ポイント分析⑦の知見に合う)。
 */
export function ChatWindow({ initialCategory }: { initialCategory: Category | null }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorCta, setErrorCta] = useState<null | { message: string; href: string; label: string }>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (category) {
      setMessages([{ role: "assistant", content: CATEGORY_PROMPT[category] }]);
    }
  }, [category]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || !category || loading) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);
    setErrorCta(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, category, message: userMessage }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setErrorCta({ message: "続きを見るにはログインが必要だよ。", href: "/auth/login", label: "ログインする" });
        return;
      }
      if (res.status === 409 && data.error === "PROFILE_REQUIRED") {
        setErrorCta({
          message: "占いには名前・生年月日の登録が先に必要だよ。",
          href: "/auth/signup",
          label: "登録する",
        });
        return;
      }
      if (res.status === 402) {
        setErrorCta({
          message: "今日の無料分は使い切ったよ。追加クレジットで続けられるよ。",
          href: "/plans",
          label: "続きを見る",
        });
        return;
      }
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: "うまく届かなかったみたい。もう一度試してみて。" }]);
        return;
      }

      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);

      if (data.isCrisis) {
        // 専門窓口案内を表示するだけで留める。結果画面への誘導や課金導線は出さない。
        return;
      }

      // 結果が確定したら結果画面へ誘導する（チャット内で完結させず、シェア可能なURLに送る）
      setTimeout(() => router.push(`/result/${data.resultId}`), 1200);
    } finally {
      setLoading(false);
    }
  }

  if (!category) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-6">
        <h1 className="font-display text-lg text-paper-50">何について相談する?</h1>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(CATEGORY_LABEL) as Category[])
            .filter((c) => c !== "TODAY")
            .map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="rounded-card border border-ink-700 bg-ink-900/50 py-6 text-sm text-paper-200 transition active:scale-[0.98]"
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col px-4">
      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && <ChatBubble role="assistant" content="占ってるところ…" pending />}
        {errorCta && (
          <div className="rounded-card border border-gold-500/40 bg-ink-900/70 p-4 text-sm text-paper-200">
            <p className="mb-3">{errorCta.message}</p>
            <a
              href={errorCta.href}
              className="inline-block rounded-full bg-gold-500 px-4 py-2 text-xs font-bold text-ink-950"
            >
              {errorCta.label}
            </a>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-ink-700 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="メッセージを入力"
          className="flex-1 rounded-full border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-paper-50 outline-none focus-visible:border-gold-500"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="rounded-full bg-gold-500 px-4 py-3 text-sm font-bold text-ink-950 disabled:opacity-40"
        >
          送る
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ role, content, pending }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? "bg-gold-500 text-ink-950" : "bg-ink-800 text-paper-100"
        } ${pending ? "animate-pulse" : ""}`}
      >
        {content}
      </div>
    </div>
  );
}
