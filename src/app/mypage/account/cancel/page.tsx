"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 画面遷移設計書の離脱ポイント分析⑦に基づき、即退会ではなく
 * 「休会」提案をワンクッション挟む設計(離脱防止と誠実さの両立)。
 */
export default function CancelAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "confirm">("intro");
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    const res = await fetch("/api/account/cancel", { method: "POST" });
    setLoading(false);
    if (res.ok) {
      router.push("/");
    }
  }

  if (step === "intro") {
    return (
      <div className="flex flex-col gap-5 px-5 pt-6">
        <h1 className="font-display text-lg text-paper-50">退会する前に</h1>
        <p className="text-sm leading-relaxed text-paper-200">
          退会すると、これまでの診断履歴やサブスクの特典がすべて失われます。
          しばらく占いをお休みしたいだけなら、サブスクを一時停止する「休会」もできます。
        </p>
        <button className="rounded-full border border-gold-500/50 py-3 text-sm font-bold text-gold-400">
          休会する(サブスクを一時停止)
        </button>
        <button
          onClick={() => setStep("confirm")}
          className="text-center text-xs text-paper-600 underline"
        >
          それでも退会する
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-6">
      <h1 className="font-display text-lg text-paper-50">本当に退会しますか?</h1>
      <p className="text-sm text-paper-400">この操作は取り消せません。</p>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded-full bg-torii-500 py-3 text-sm font-bold text-paper-50 disabled:opacity-40"
      >
        退会する
      </button>
      <button onClick={() => setStep("intro")} className="text-center text-xs text-paper-600 underline">
        キャンセル
      </button>
    </div>
  );
}
