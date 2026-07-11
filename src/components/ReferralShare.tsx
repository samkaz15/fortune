"use client";

/**
 * 紹介制度のシェアUI(2026-07-07復活・Marketing-011,012)。
 * 招待した人・された人の双方にポイント特典がある設計(既存/api/auth/signupロジックのまま)。
 * マイページに常設し、SNSシェアと連動させることで口コミが自然発生する導線にする
 * (docs/marketing/05_Referral.md参照)。
 */
import { useState } from "react";
import { track } from "@/lib/track-client";

export function ReferralShare({ referralCode, invitedCount }: { referralCode: string; invitedCount: number }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/invite/${referralCode}` : "";
  const shareText = "毎日の運勢をAIが占ってくれる「錦糸町の少年」、招待コードで登録するとポイントがもらえます";
  const enc = encodeURIComponent;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      track("share", { platform: "referral_copy" });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  }

  return (
    <section className="rounded-card border border-gold-500/40 bg-gold-500/5 p-5">
      <p className="mb-1 text-[9px] font-bold tracking-widest text-gold-400">友達を紹介する</p>
      <p className="mb-3 text-xs leading-relaxed text-paper-300">
        招待した友達が登録すると、あなたと友達の両方にポイントがプレゼントされます。
      </p>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-950 px-3 py-2">
        <code className="flex-1 truncate text-[11px] text-paper-200">{inviteUrl}</code>
        <button onClick={copyLink} className="shrink-0 rounded-full bg-gold-500 px-3 py-1 text-[10px] font-bold text-ink-950">
          {copied ? "コピー済み" : "コピー"}
        </button>
      </div>
      <div className="mb-3 flex justify-center gap-2">
        <a
          href={`https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(inviteUrl)}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("share", { platform: "referral_x" })}
          className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200"
        >
          Xでシェア
        </a>
        <a
          href={`https://social-plugins.line.me/lineit/share?url=${enc(inviteUrl)}&text=${enc(shareText)}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("share", { platform: "referral_line" })}
          className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200"
        >
          LINEでシェア
        </a>
      </div>
      <p className="text-center text-[10px] text-paper-500">これまでに {invitedCount} 人を招待しました</p>
    </section>
  );
}
