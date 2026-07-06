"use client";

/**
 * UI仕様v5の共通コンポーネント群(2026-07-06)
 * - GlassMosaic: 有料コンテンツのモザイク(CSS blur + glass。黒モザイク禁止)
 * - ScrollProgress: 結果画面のスクロール率プログレスバー
 * - FloatingCTA: 全診断共通の追従ボタン(余白付きFloating Button)
 * - ShareRow: SNS共有(Instagram/X/TikTok/LINE)。Web Share API+各インテント
 */
import { useEffect, useState } from "react";
import Link from "next/link";

export function GlassMosaic({
  children,
  message,
  ctaLabel,
  ctaHref,
  note,
}: {
  children: React.ReactNode;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  note?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-ink-700" style={{ minHeight: 190 }}>
      <div className="select-none p-5 blur-[8px]" aria-hidden>
        {children}
      </div>
      {/* glass effect(黒モザイク禁止): 半透明+backdrop-blurの磨りガラス */}
      <div className="absolute inset-0 flex flex-col items-center justify-end bg-ink-950/35 p-5 text-center backdrop-blur-[2px]">
        <p className="mb-3 text-[11px] font-bold leading-relaxed text-paper-100">{message}</p>
        <Link
          href={ctaHref}
          className="w-full rounded-full bg-gold-500 py-3 text-xs font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1"
        >
          {ctaLabel}
        </Link>
        {note && <p className="mt-2 text-[10px] text-paper-400">{note}</p>}
      </div>
    </div>
  );
}

export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
      <div className="h-full bg-gradient-to-r from-gold-500 to-gold-400 transition-[width] duration-150" style={{ width: `${p}%` }} />
    </div>
  );
}

export function FloatingCTA({ label, href, note }: { label: string; href: string; note?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-6">
      <Link
        href={href}
        className="pointer-events-auto block rounded-full bg-gold-500 py-3.5 text-center text-sm font-bold text-ink-950 shadow-[0_8px_24px_-6px_rgba(217,166,46,.55),0_4px_0_#8a6b25] active:translate-y-1"
      >
        {label}
      </Link>
      {note && <p className="pointer-events-none mt-1.5 text-center text-[10px] text-paper-400">{note}</p>}
    </div>
  );
}

export function ShareRow({ text, title }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const enc = encodeURIComponent;
  async function nativeShare() {
    try {
      if (navigator.share) await navigator.share({ title: title ?? "糸町の少年", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* キャンセルは無視 */
    }
  }
  return (
    <div className="mt-4">
      <p className="mb-2 text-center text-[10px] font-bold tracking-widest text-paper-500">SHARE ｜ 結果をシェア</p>
      <div className="flex justify-center gap-2">
        <a href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noreferrer" className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200">X</a>
        <a href={`https://social-plugins.line.me/lineit/share?url=${enc(url)}&text=${enc(text)}`} target="_blank" rel="noreferrer" className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200">LINE</a>
        {/* Instagram/TikTokは共有URLスキームが無いためネイティブ共有(アプリ選択)で対応 */}
        <button onClick={nativeShare} className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200">Instagram / TikTok</button>
      </div>
      {copied && <p className="mt-1 text-center text-[10px] text-gold-400">リンクをコピーしました</p>}
    </div>
  );
}

/**
 * アフィリエイト枠(UI仕様v5): 余白のみ確保・実装なし。
 * 上下40px余白、サイズ固定せず(横長/カード/画像/テキスト全対応の柔軟枠)。
 * サブスク導線を妨げない位置にのみ配置すること。
 */
export function AffSlot({ label = "AD SLOT" }: { label?: string }) {
  return (
    <div className="my-10 flex min-h-[100px] w-full items-center justify-center rounded-2xl border border-dashed border-ink-700/40 text-[9px] tracking-[0.25em] text-ink-600">
      {label}
    </div>
  );
}
