"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 画面遷移設計書の判断：決済完了を独立した「見せるだけの画面」にせず、
 * 最小限のサンクス表示のみでマイページへ自動遷移させる(UX改善提案②の実装反映)。
 */
export default function PlanCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/mypage"), 1800);
    return () => clearTimeout(timer);
  }, [router]);

  const message =
    type === "subscribe"
      ? "サブスク登録が完了したよ。これで診断し放題。"
      : "クレジットを追加したよ。続きから占っていこう。";

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-5 pt-24 text-center">
      <p className="font-display text-lg text-gold-400">ありがとう。</p>
      <p className="text-sm text-paper-200">{message}</p>
    </div>
  );
}
